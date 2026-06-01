mod storage;

#[tauri::command]
fn get_memories() -> Result<Vec<storage::UniversalMemory>, String> {
    storage::load_config().map(|c| c.universal_memories)
}

#[tauri::command]
fn get_entries(memory_name: String) -> Result<Vec<storage::StorageEntry>, String> {
    storage::read_all_entries(&memory_name)
}

#[tauri::command]
fn get_entry(memory_name: String, id: u32) -> Result<storage::StorageEntry, String> {
    storage::read_entry(&memory_name, id)
}

#[tauri::command]
fn create_entry(
    memory_name: String,
    title: String,
    content: String,
    tags: Vec<String>,
) -> Result<storage::StorageEntry, String> {
    storage::create_entry(&memory_name, &title, &content, &tags)
}

#[tauri::command]
fn update_entry(
    memory_name: String,
    id: u32,
    title: String,
    content: String,
    tags: Vec<String>,
) -> Result<storage::StorageEntry, String> {
    storage::update_entry(&memory_name, id, &title, &content, &tags)
}

#[tauri::command]
fn delete_entry(memory_name: String, id: u32) -> Result<(), String> {
    storage::delete_entry(&memory_name, id)
}

#[tauri::command]
fn search_entries(memory_name: String, query: String) -> Result<Vec<storage::StorageEntry>, String> {
    storage::search_entries(&memory_name, &query)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_memories,
            get_entries,
            get_entry,
            create_entry,
            update_entry,
            delete_entry,
            search_entries,
        ])
        .run(tauri::generate_context!())
        .expect("error while running memlink gui");
}
