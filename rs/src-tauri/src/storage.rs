use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

// ── Types ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalMemory {
    pub memory_id: String,
    pub memory_name: String,
    pub created_at: String,
    #[serde(default)]
    pub last_seen: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemlinkConfig {
    pub universal_memories: Vec<UniversalMemory>,
    #[serde(default)]
    pub server_port: Option<u16>,
    #[serde(default)]
    pub server_host: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageIndex {
    pub memory_name: String,
    pub memory_id: String,
    pub next_id: u32,
    pub entries: Vec<IndexEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexEntry {
    pub id: u32,
    pub title: String,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageEntry {
    pub id: u32,
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    pub updated_at: String,
}

// ── Paths ────────────────────────────────────────────

fn memlink_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("MEMLINK_DIR") {
        PathBuf::from(dir)
    } else {
        dirs::home_dir()
            .expect("could not find home dir")
            .join(".memlink")
    }
}

fn memory_dir(name: &str) -> PathBuf {
    memlink_dir().join(name)
}

fn index_path(name: &str) -> PathBuf {
    memory_dir(name).join("index.json")
}

fn entry_path(name: &str, id: u32) -> PathBuf {
    memory_dir(name).join(format!("{id}.json"))
}

// ── Commands ─────────────────────────────────────────

pub fn load_config() -> Result<MemlinkConfig, String> {
    let path = memlink_dir().join("settings.json");
    let raw = fs::read_to_string(&path).map_err(|e| format!("reading settings.json: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("parsing settings.json: {e}"))
}

pub fn read_index(name: &str) -> Result<StorageIndex, String> {
    let raw = fs::read_to_string(index_path(name))
        .map_err(|e| format!("reading index for {name}: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("parsing index for {name}: {e}"))
}

pub fn read_entry(name: &str, id: u32) -> Result<StorageEntry, String> {
    let raw = fs::read_to_string(entry_path(name, id))
        .map_err(|e| format!("reading entry {id}: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("parsing entry {id}: {e}"))
}

pub fn read_all_entries(name: &str) -> Result<Vec<StorageEntry>, String> {
    let index = read_index(name)?;
    let mut entries = Vec::with_capacity(index.entries.len());
    for e in &index.entries {
        if let Ok(entry) = read_entry(name, e.id) {
            entries.push(entry);
        }
    }
    Ok(entries)
}

pub fn create_entry(
    name: &str,
    title: &str,
    content: &str,
    tags: &[String],
) -> Result<StorageEntry, String> {
    let mut index = read_index(name)?;
    let id = index.next_id;
    index.next_id += 1;

    let now = timestamp();
    let entry = StorageEntry {
        id,
        title: title.to_owned(),
        content: content.to_owned(),
        tags: if tags.is_empty() {
            None
        } else {
            Some(tags.to_vec())
        },
        updated_at: now.clone(),
    };

    fs::write(entry_path(name, id), serde_json::to_string_pretty(&entry).unwrap())
        .map_err(|e| format!("writing entry {id}: {e}"))?;

    index.entries.push(IndexEntry {
        id,
        title: title.to_owned(),
        tags: entry.tags.clone(),
        updated_at: now,
    });
    fs::write(index_path(name), serde_json::to_string_pretty(&index).unwrap())
        .map_err(|e| format!("writing index for {name}: {e}"))?;

    Ok(entry)
}

pub fn update_entry(
    name: &str,
    id: u32,
    title: &str,
    content: &str,
    tags: &[String],
) -> Result<StorageEntry, String> {
    let mut index = read_index(name)?;
    let now = timestamp();

    let entry = StorageEntry {
        id,
        title: title.to_owned(),
        content: content.to_owned(),
        tags: if tags.is_empty() {
            None
        } else {
            Some(tags.to_vec())
        },
        updated_at: now.clone(),
    };

    fs::write(entry_path(name, id), serde_json::to_string_pretty(&entry).unwrap())
        .map_err(|e| format!("writing entry {id}: {e}"))?;

    if let Some(e) = index.entries.iter_mut().find(|e| e.id == id) {
        e.title = title.to_owned();
        e.tags = entry.tags.clone();
        e.updated_at = now;
    }
    fs::write(index_path(name), serde_json::to_string_pretty(&index).unwrap())
        .map_err(|e| format!("writing index for {name}: {e}"))?;

    Ok(entry)
}

pub fn delete_entry(name: &str, id: u32) -> Result<(), String> {
    let mut index = read_index(name)?;
    let path = entry_path(name, id);
    let _ = fs::remove_file(&path);

    index.entries.retain(|e| e.id != id);
    fs::write(index_path(name), serde_json::to_string_pretty(&index).unwrap())
        .map_err(|e| format!("writing index for {name}: {e}"))?;

    Ok(())
}

pub fn search_entries(name: &str, query: &str) -> Result<Vec<StorageEntry>, String> {
    let q = query.to_lowercase();
    let all = read_all_entries(name)?;
    Ok(all
        .into_iter()
        .filter(|e| {
            e.title.to_lowercase().contains(&q)
                || e.content.to_lowercase().contains(&q)
                || e.tags
                    .as_ref()
                    .is_some_and(|t| t.iter().any(|t| t.to_lowercase().contains(&q)))
        })
        .collect())
}

fn timestamp() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}
