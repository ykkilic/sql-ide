from fastapi import FastAPI, Request, Response, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
import asyncpg
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins, for production, specify exact domains
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Middleware for OPTIONS requests
class OptionsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            # Return an empty response for OPTIONS requests
            response = Response()
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Max-Age"] = "86400"  # Cache for 24 hours
            return response
        
        # Process other requests normally
        response = await call_next(request)
        return response

# Add the middleware
app.add_middleware(OptionsMiddleware)

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_DATABASE")
}

# Request body model
class Item(BaseModel):
    query: str
    # db_name: str

@app.post("/sql/execute")
async def execute_sql(item: Item):
    """
    Executes the given SQL query on the predefined PostgreSQL database
    and returns the results.
    """
    conn = None
    try:
        # Use predefined credentials to establish database connection
        conn = await asyncpg.connect(**DB_CONFIG)

        # Determine if the query is a DML/DDL query like SELECT, INSERT, UPDATE, DELETE
        query_lower = item.query.strip().lower()

        if query_lower.startswith('select') or query_lower.startswith('show') or query_lower.startswith('with'):
            # Fetch data for SELECT queries
            rows = await conn.fetch(item.query)
            
            # Format results appropriately for JSON conversion
            results = [dict(r) for r in rows]
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": "success",
                    "message": f"{len(results)} rows returned.",
                    "query": item.query,
                    "database": DB_CONFIG["database"], # Return database info from backend
                    "results": results,
                    "row_count": len(results)
                }
            )
        else:
            # For INSERT, UPDATE, DELETE, CREATE, DROP etc. queries, just execute
            command_status = await conn.execute(item.query)
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": "success",
                    "message": f"Query executed successfully: {command_status}",
                    "query": item.query,
                    "database": DB_CONFIG["database"], # Return database info from backend
                    "command_status": command_status
                }
            )
    except asyncpg.exceptions.PostgresError as e:
        print(f"Database error during SQL execution: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "status": "error",
                "message": f"Database error occurred while executing SQL query: {e}",
                "query": item.query,
                "database": DB_CONFIG["database"],
                "error_detail": str(e)
            }
        )
    except Exception as e:
        print(f"An unexpected error occurred during SQL execution: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "status": "error",
                "message": "An unexpected error occurred while executing SQL query.",
                "query": item.query,
                "database": DB_CONFIG["database"],
                "error_detail": str(e)
            }
        )
    finally:
        if conn:
            await conn.close()

class DBConnectionInfo(BaseModel):
    host: str
    port: int
    user: str
    password: str
    database: str

@app.post("/get-full-schema-info")
async def get_full_schema_info(conn_info: DBConnectionInfo):
    """
    Connects to a PostgreSQL database and fetches comprehensive schema information
    including tables, columns, views, functions, and stored procedures with their source queries.
    If a category has no data, it returns an empty list/dictionary for that category.
    Functions and procedures are returned in separate lists under 'routines'.
    """
    conn = None
    try:
        conn = await asyncpg.connect(
            user=conn_info.user,
            password=conn_info.password,
            database=conn_info.database,
            host=conn_info.host,
            port=conn_info.port
        )

        full_schema_data = {}

        # Initialize schema structure with empty containers
        schemas_to_check = await conn.fetch("""
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        """)
        for s_row in schemas_to_check:
            schema_name = s_row['schema_name']
            full_schema_data[schema_name] = {
                'tables': {},
                'views': [],
                'routines': {
                    'functions': [],
                    'procedures': []
                }
            }

        # --- 1. Tables and Columns ---
        tables_columns_rows = await conn.fetch("""
            SELECT 
                table_schema, 
                table_name, 
                column_name, 
                data_type, 
                is_nullable, 
                column_default
            FROM information_schema.columns
            WHERE 
                table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY table_schema, table_name, ordinal_position
        """)

        for row in tables_columns_rows:
            schema = row['table_schema']
            table = row['table_name']
            full_schema_data[schema]['tables'].setdefault(table, {'columns': []})
            full_schema_data[schema]['tables'][table]['columns'].append({
                'column_name': row['column_name'],
                'data_type': row['data_type'],
                'is_nullable': row['is_nullable'] == 'YES',
                'column_default': row['column_default']
            })

        # --- 2. Views ---
        views_rows = await conn.fetch("""
            SELECT 
                table_schema, 
                table_name AS view_name, 
                view_definition
            FROM information_schema.views
            WHERE 
                table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY table_schema, view_name
        """)

        for row in views_rows:
            schema = row['table_schema']
            full_schema_data[schema]['views'].append({
                'view_name': row['view_name'],
                'view_definition': row['view_definition']
            })

        # --- 3. Functions and Procedures (Separated with Source Query) ---
        routines_rows = await conn.fetch("""
            SELECT 
                n.nspname AS schema_name,
                p.proname AS routine_name,
                CASE 
                    WHEN p.prokind = 'f' THEN 'FUNCTION'
                    WHEN p.prokind = 'p' THEN 'PROCEDURE'
                    ELSE 'OTHER' 
                END AS routine_type,
                pg_get_function_result(p.oid) AS return_type,
                pg_get_function_arguments(p.oid) AS arguments,
                pg_get_functiondef(p.oid) AS source_query -- Get the full definition
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE 
                n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                AND pg_get_function_arguments(p.oid) IS NOT NULL
            ORDER BY schema_name, routine_name
        """)

        for row in routines_rows:
            schema = row['schema_name']
            routine_info = {
                'routine_name': row['routine_name'],
                'return_type': row['return_type'],
                'arguments': row['arguments'],
                'source_query': row['source_query'] # Add the source query here
            }
            if row['routine_type'] == 'FUNCTION':
                full_schema_data[schema]['routines']['functions'].append(routine_info)
            elif row['routine_type'] == 'PROCEDURE':
                full_schema_data[schema]['routines']['procedures'].append(routine_info)

        # Sort keys for consistent output (optional, but good for readability)
        sorted_schema_data = {
            schema_name: {
                'tables': {k: v for k, v in sorted(data.get('tables', {}).items())},
                'views': sorted(data.get('views', []), key=lambda x: x['view_name']),
                'routines': {
                    'functions': sorted(data['routines'].get('functions', []), key=lambda x: x['routine_name']),
                    'procedures': sorted(data['routines'].get('procedures', []), key=lambda x: x['routine_name'])
                }
            }
            for schema_name, data in sorted(full_schema_data.items())
        }

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"schemas": sorted_schema_data}
        )

    except asyncpg.exceptions.PostgresError as e:
        print(f"Database error: {e}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"message": f"Database connection or query error: {e}"}
        )
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "There was an error while fetching database schema info."}
        )
    finally:
        if conn:
            await conn.close()