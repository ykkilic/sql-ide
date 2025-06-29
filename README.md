# 📊 SQL IDE

**SQL IDE** is a full-stack application for safely executing SQL queries and exploring PostgreSQL database schemas. The backend is built with FastAPI and `asyncpg`, while the frontend provides an intuitive and interactive user interface.

---

## 🚀 Features

- ✅ Add / Delete / Update Tasks – Full CRUD functionality
- 📌 Mark Tasks as Completed
- 📖 Interactive API Documentation with Swagger UI
- 🧠 Explore PostgreSQL Schemas

---

## 🛠️ Setup

Follow these steps to get the project up and running:

### 1. Clone the Repository

```bash
git clone https://github.com/ykkilic/sql-ide.git
cd sql-ide
```
```bash
# On Windows
python -m venv venv
.\venv\Scripts\activate

# On macOS/Linux
python3 -m venv venv
source venv/bin/activate
```
### Install Dependencies
```bash
pip install -r requirements.txt
```
# Create a .env File
In the project root directory, create a file named .env with your PostgreSQL credentials:
```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_todo_database
```
⚠️ Replace your_username, your_password, and your_todo_database with your actual PostgreSQL settings.

# Set Up the Database (Optional)
```sql
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE
);
```

# Start the Application
```bash
uvicorn main:app --reload
```

# 💡 Usage
Once the application is running, you can test the API through:
Swagger UI: http://127.0.0.1:8000/docs
ReDoc: http://127.0.0.1:8000/redoc
Use these interfaces to create, retrieve, update, or delete tasks.







