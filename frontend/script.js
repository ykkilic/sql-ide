// Satır numaralarını güncelle
function updateLineNumbers() {
  const editor = document.getElementById("sqlEditor");
  const lineNumbers = document.getElementById("lineNumbers");
  const lines = editor.value.split("\n").length;

  let lineNumbersHtml = "";
  for (let i = 1; i <= lines; i++) {
    lineNumbersHtml += i + "<br>";
  }
  lineNumbers.innerHTML = lineNumbersHtml;
}

// Scroll senkronizasyonu
function syncScroll() {
  const editor = document.getElementById("sqlEditor");
  const lineNumbers = document.getElementById("lineNumbers");
  lineNumbers.scrollTop = editor.scrollTop;
}

// Cursor pozisyonunu güncelle
function updateCursor() {
  // Bu fonksiyon cursor pozisyonu için genişletilebilir
}

// // SQL sorgusu çalıştır
// function executeQuery() {
//   const query = document.getElementById("sqlEditor").value.trim();
//   const dbName = document.getElementById("db-name").textContent.trim();

//   if (!query) {
//     alert("Lütfen bir SQL sorgusu yazın.");
//     return;
//   }

//   const reqData = {
//     query: query,
//     db_name: dbName,
//   };

//   console.log(reqData, "Request Data");

//   fetch("http://localhost:8090/sql/execute", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify(reqData),
//   })
//     .then((response) => response.json())
//     .then((result) => {
//       console.log("Başarılı:", result);
//     })
//     .catch((error) => {
//       console.error("Hata:", error);
//     });

//   // Simüle edilmiş başarı mesajı
//   updateStatus("Sorgu başarıyla çalıştırıldı.");
// }

async function executeQuery() {
  const editor = document.getElementById("sqlEditor");
  const query = editor.value.trim();

  if (!query) {
    updateStatus("Lütfen bir SQL sorgusu yazın.");
    return;
  }

  updateStatus("Sorgu çalıştırılıyor...");

  // Sorgu başlatma zamanını kaydedin
  window.queryStartTime = Date.now();

  try {
    const response = await fetch("http://localhost:8090/sql/execute", {
      // FastAPI endpoint'iniz
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: query }),
    });

    const data = await response.json();
    const duration = ((Date.now() - window.queryStartTime) / 1000).toFixed(3); // Süreyi milisaniyeye kadar formatla

    if (!response.ok) {
      // Hata durumunda, backend'den gelen detayları göster
      throw new Error(
        data.detail.message || "Sorgu yürütülürken bir hata oluştu."
      );
    }

    if (data.status === "success") {
      // Başarı mesajını ve süreyi güncelle
      updateStatus(`${data.message} (${duration}s)`);

      // Sonuçları render et
      if (data.results) {
        // SELECT sorgusu ise
        renderResults(data.results);
        // Satır sayısını güncelle
        document.querySelector(
          ".results-header div span"
        ).textContent = `${data.row_count} satır döndürüldü (${duration}s)`;
      } else {
        // DML/DDL sorgusu ise
        renderResults([]); // Tabloyu temizle
        document.querySelector(
          ".results-header div span"
        ).textContent = `Komut Durumu: ${data.command_status} (${duration}s)`;
      }
    } else {
      // Backend'den success=false dönse bile hata olarak göster
      updateStatus(`Hata: ${data.message} (${duration}s)`);
      renderResults([]); // Hata durumunda tabloyu temizle
    }
  } catch (error) {
    console.error("Sorgu yürütülürken hata oluştu:", error);
    updateStatus(`Hata: ${error.message} (${duration}s)`); // Hata durumunda da süreyi göster
    renderResults([]); // Hata durumunda tabloyu temizle
  } finally {
    // Query başlatma zamanını sıfırla (eğer gerekirse)
    // window.queryStartTime = null;
  }
}

function renderResults(results) {
  const resultsContent = document.querySelector(".results-content");

  // Eski içeriği temizle
  resultsContent.innerHTML = "";

  // Eğer sonuç yoksa veya boşsa bir mesaj göster
  if (!results || results.length === 0) {
    resultsContent.innerHTML =
      '<p style="color: #ccc;">Sonuç bulunamadı veya sorgu bir sonuç döndürmedi.</p>';
    return;
  }

  const table = document.createElement("table");
  table.className = "results-table fade-in"; // Animasyon için sınıf ekleyelim

  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  // Başlık satırını oluştur (sütun isimleri)
  const headerRow = document.createElement("tr");
  // İlk sonucun anahtarlarını alarak başlıkları oluştur.
  // Eğer results dizisi boş değilse, ilk elemanın anahtarlarını kullanırız.
  const columns = Object.keys(results[0]);
  columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Veri satırlarını oluştur
  results.forEach((rowData) => {
    const tr = document.createElement("tr");
    columns.forEach((col) => {
      const td = document.createElement("td");
      // Null değerleri daha okunaklı hale getir
      td.textContent = rowData[col] === null ? "NULL" : rowData[col];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  resultsContent.appendChild(table);
}

// Sorguyu kaydet
function saveQuery() {
  const editor = document.getElementById("sqlEditor");
  const query = editor.value;

  // Simüle edilmiş kaydetme
  const blob = new Blob([query], { type: "text/sql" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "query.sql";
  a.click();
  URL.revokeObjectURL(url);

  updateStatus("Sorgu kaydedildi.");
}

// Sorgu aç
function openQuery() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".sql";
  input.onchange = function (e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        document.getElementById("sqlEditor").value = e.target.result;
        updateLineNumbers();
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

// Sorguyu formatla
function formatQuery() {
  const editor = document.getElementById("sqlEditor");
  let query = editor.value;

  // Basit SQL formatlama
  query = query.replace(/\s+/g, " ");
  query = query.replace(/SELECT/gi, "\nSELECT");
  query = query.replace(/FROM/gi, "\nFROM");
  query = query.replace(/WHERE/gi, "\nWHERE");
  query = query.replace(/ORDER BY/gi, "\nORDER BY");
  query = query.replace(/GROUP BY/gi, "\nGROUP BY");
  query = query.replace(/HAVING/gi, "\nHAVING");

  editor.value = query.trim();
  updateLineNumbers();
  updateStatus("Sorgu formatlandı.");
}

// Editörü temizle
function clearEditor() {
  if (confirm("Editördeki tüm içerik silinecek. Emin misiniz?")) {
    document.getElementById("sqlEditor").value = "";
    updateLineNumbers();
    updateStatus("Editör temizlendi.");
  }
}

// Tema değiştir
function toggleTheme() {
  // Bu fonksiyon light/dark tema değişimi için genişletilebilir
  updateStatus("Tema değiştirildi.");
}

// Tree item toggle
function toggleTreeItem(item) {
  item.classList.toggle("expanded");
}

// Tablo seç
function selectTable(tableName) {
  const editor = document.getElementById("sqlEditor");
  editor.value = `SELECT * FROM ${tableName};`;
  updateLineNumbers();
  updateStatus(`${tableName} tablosu seçildi.`);
}

// Yeni sekme
function newTab() {
  const tabBar = document.querySelector(".tab-bar");
  const tabCount = tabBar.querySelectorAll(".tab").length + 1;

  const newTab = document.createElement("button");
  newTab.className = "tab";
  newTab.innerHTML = `
                <span>Query ${tabCount}</span>
                <span class="tab-close" onclick="closeTab(this)">×</span>
            `;

  tabBar.insertBefore(newTab, tabBar.lastElementChild);

  // Aktif sekmeyi güncelle
  document
    .querySelectorAll(".tab")
    .forEach((tab) => tab.classList.remove("active"));
  newTab.classList.add("active");
}

// Sekme kapat
function closeTab(closeBtn) {
  const tab = closeBtn.parentElement;
  const tabBar = tab.parentElement;

  if (tabBar.querySelectorAll(".tab").length > 1) {
    tab.remove();
  } else {
    alert("En az bir sekme açık kalmalıdır.");
  }
}

// Status güncelle
function updateStatus(message) {
  const statusBar = document.querySelector(".status-bar div:last-child");
  statusBar.textContent = message;

  setTimeout(() => {
    statusBar.textContent = "Hazır";
  }, 3000);
}

// Sayfa yüklendiğinde
document.addEventListener("DOMContentLoaded", function () {
  updateLineNumbers();

  // Tab click events
  document.addEventListener("click", function (e) {
    if (e.target.closest(".tab") && !e.target.classList.contains("tab-close")) {
      document
        .querySelectorAll(".tab")
        .forEach((tab) => tab.classList.remove("active"));
      e.target.closest(".tab").classList.add("active");
    }
  });
});

async function fetchSchemaInfo(user, password, database, host, port) {
  updateStatus("Şema bilgileri yükleniyor...");
  const connInfo = {
    user: "postgres",
    password: "Bjk1903",
    database: "kafka_test",
    host: "127.0.0.1", // FastAPI sunucusunun çalıştığı host
    port: "5432", // PostgreSQL varsayılan portu
  };

  try {
    const response = await fetch("http://localhost:8090/get-full-schema-info", {
      // FastAPI sunucunuzun adresini kontrol edin
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(connInfo),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Şema bilgileri getirilemedi.");
    }
    const data = await response.json();
    console.log("Şema Bilgileri:", data.schemas);
    updateDatabaseTree(data.schemas); // Şema bilgilerini UI'a aktar
    updateStatus("Şema bilgileri başarıyla yüklendi.");
  } catch (error) {
    console.error("Şema bilgisi alınırken hata oluştu:", error);
    updateStatus(`Hata: ${error.message}`);
  }
}

// Veritabanı ağacını güncelleyen fonksiyon
function updateDatabaseTree(schemas) {
  const databaseTreeDiv = document.querySelector(".database-tree");

  // Mevcut dinamik içeriği temizle (sadece ana düğümü koru)
  // İlk .tree-item ve onun ilk .tree-children hariç hepsini sil
  const existingChildren = databaseTreeDiv.querySelectorAll(
    ".tree-children > .tree-item, .tree-children > .tree-children"
  );
  existingChildren.forEach((child) => child.remove());

  const rootTreeItem = databaseTreeDiv.querySelector(".tree-item.expanded");
  const rootTreeChildrenContainer = rootTreeItem.nextElementSibling; // .tree-children div

  // Her bir şemayı ağaca ekle
  for (const schemaName in schemas) {
    const schemaData = schemas[schemaName];

    const schemaItem = createTreeItem(schemaName, "🗄️"); // Her şema için yeni bir kök öğesi
    rootTreeChildrenContainer.appendChild(schemaItem);

    const schemaChildrenContainer = document.createElement("div");
    schemaChildrenContainer.className = "tree-children";
    schemaChildrenContainer.style.display = "block"; // Varsayılan olarak açık tut
    schemaItem.parentNode.insertBefore(
      schemaChildrenContainer,
      schemaItem.nextSibling
    );

    // Tabloları ekle
    if (Object.keys(schemaData.tables).length > 0) {
      const tablesHeader = createTreeItem("Tablolar", "📋");
      schemaChildrenContainer.appendChild(tablesHeader);
      const tablesChildren = document.createElement("div");
      tablesChildren.className = "tree-children";
      tablesChildren.style.display = "block";
      schemaChildrenContainer.appendChild(tablesChildren);

      for (const tableName in schemaData.tables) {
        const tableItem = createTreeItem(
          tableName,
          "📊",
          `selectTable('${tableName}')`
        );
        tablesChildren.appendChild(tableItem);

        // Sütunları tablo altına ekle (isteğe bağlı olarak)
        const tableColumnsChildren = document.createElement("div");
        tableColumnsChildren.className = "tree-children";
        tableColumnsChildren.style.display = "none"; // Sütunları varsayılan olarak kapalı tut
        tableItem.parentNode.insertBefore(
          tableColumnsChildren,
          tableItem.nextSibling
        );

        schemaData.tables[tableName].columns.forEach((column) => {
          const columnItem = createTreeItem(
            `${column.column_name} (${column.data_type})`,
            "🔠"
          );
          tableColumnsChildren.appendChild(columnItem);
        });
      }
    }

    // Görünümleri ekle
    if (schemaData.views.length > 0) {
      const viewsHeader = createTreeItem("Görünümler", "⚙️");
      schemaChildrenContainer.appendChild(viewsHeader);
      const viewsChildren = document.createElement("div");
      viewsChildren.className = "tree-children";
      viewsChildren.style.display = "block";
      schemaChildrenContainer.appendChild(viewsChildren);

      schemaData.views.forEach((view) => {
        const viewItem = createTreeItem(
          view.view_name,
          "👁️",
          `selectView('${view.view_name}', \`${view.view_definition.replace(
            /`/g,
            "\\`"
          )}\`)`
        ); // Görünüm tanımını aktar
        viewsChildren.appendChild(viewItem);
      });
    }

    // Fonksiyonları ekle
    if (schemaData.routines.functions.length > 0) {
      const functionsHeader = createTreeItem("Fonksiyonlar", "ƒ()");
      schemaChildrenContainer.appendChild(functionsHeader);
      const functionsChildren = document.createElement("div");
      functionsChildren.className = "tree-children";
      functionsChildren.style.display = "block";
      schemaChildrenContainer.appendChild(functionsChildren);

      schemaData.routines.functions.forEach((func) => {
        const funcItem = createTreeItem(
          func.routine_name,
          "🔵",
          `selectRoutine('${
            func.routine_name
          }', 'FUNCTION', \`${func.source_query.replace(/`/g, "\\`")}\`)`
        ); // Kaynak kodu aktar
        functionsChildren.appendChild(funcItem);
      });
    }

    // Prosedürleri ekle
    if (schemaData.routines.procedures.length > 0) {
      const proceduresHeader = createTreeItem("Prosedürler", "⅃");
      schemaChildrenContainer.appendChild(proceduresHeader);
      const proceduresChildren = document.createElement("div");
      proceduresChildren.className = "tree-children";
      proceduresChildren.style.display = "block";
      schemaChildrenContainer.appendChild(proceduresChildren);

      schemaData.routines.procedures.forEach((proc) => {
        const procItem = createTreeItem(
          proc.routine_name,
          "🟣",
          `selectRoutine('${
            proc.routine_name
          }', 'PROCEDURE', \`${proc.source_query.replace(/`/g, "\\`")}\`)`
        ); // Kaynak kodu aktar
        proceduresChildren.appendChild(procItem);
      });
    }
  }
  // "MyDatabase SabreTruth" yazısını ilk şemanın adıyla değiştir
  const dbNameSpan = document.getElementById("db-name");
  if (Object.keys(schemas).length > 0) {
    dbNameSpan.textContent = Object.keys(schemas)[0]; // İlk şemanın adını kullan
  } else {
    dbNameSpan.textContent = "Veritabanı (Boş)";
  }
}

// Ağaç öğesi oluşturan yardımcı fonksiyon
function createTreeItem(text, icon, onClickAction = null) {
  const div = document.createElement("div");
  div.className = "tree-item";
  if (onClickAction) {
    div.setAttribute("onclick", onClickAction);
  } else {
    div.setAttribute("onclick", "toggleTreeItem(this)"); // Varsayılan olarak açma/kapama
  }

  const iconDiv = document.createElement("div");
  iconDiv.className = "tree-icon";
  iconDiv.textContent = icon;

  const span = document.createElement("span");
  span.textContent = text;

  div.appendChild(iconDiv);
  div.appendChild(span);
  return div;
}

// Yeni: Görünüm seçildiğinde editöre tanımını yaz
function selectView(viewName, viewDefinition) {
  const editor = document.getElementById("sqlEditor");
  editor.value = viewDefinition;
  updateLineNumbers();
  updateStatus(`Görünüm '${viewName}' tanımı yüklendi.`);
}

// Yeni: Rutin (fonksiyon/prosedür) seçildiğinde editöre kaynak kodunu yaz
function selectRoutine(routineName, routineType, sourceQuery) {
  const editor = document.getElementById("sqlEditor");
  editor.value = sourceQuery;
  updateLineNumbers();
  updateStatus(`${routineType} '${routineName}' kaynak kodu yüklendi.`);
}

// Sayfa yüklendiğinde
document.addEventListener("DOMContentLoaded", function () {
  updateLineNumbers();

  // Tab click events
  document.addEventListener("click", function (e) {
    if (e.target.closest(".tab") && !e.target.classList.contains("tab-close")) {
      document
        .querySelectorAll(".tab")
        .forEach((tab) => tab.classList.remove("active"));
      e.target.closest(".tab").classList.add("active");
    }
  });

  // Sayfa yüklendiğinde şema bilgilerini çek
  fetchSchemaInfo();
});
