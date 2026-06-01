use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub fn memlink_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("MEMLINK_DIR") {
        PathBuf::from(dir)
    } else {
        dirs::home_dir()
            .expect("could not find home dir")
            .join(".memlink")
    }
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
pub struct UniversalMemory {
    pub memory_id: String,
    pub memory_name: String,
    pub created_at: String,
    #[serde(default)]
    pub last_seen: Option<String>,
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
