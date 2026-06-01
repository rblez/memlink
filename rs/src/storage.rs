use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;

use crate::types::*;

fn memory_dir(name: &str) -> PathBuf {
    memlink_dir().join(name)
}

fn index_path(name: &str) -> PathBuf {
    memory_dir(name).join("index.json")
}

fn entry_path(name: &str, id: u32) -> PathBuf {
    memory_dir(name).join(format!("{id}.json"))
}

pub fn load_config() -> Result<MemlinkConfig> {
    let path = memlink_dir().join("settings.json");
    let raw = fs::read_to_string(&path)
        .with_context(|| format!("reading {path:?}"))?;
    Ok(serde_json::from_str(&raw)?)
}

pub fn read_index(name: &str) -> Result<StorageIndex> {
    let raw = fs::read_to_string(index_path(name))
        .with_context(|| format!("reading index for {name}"))?;
    Ok(serde_json::from_str(&raw)?)
}

pub fn read_entry(name: &str, id: u32) -> Result<StorageEntry> {
    let raw = fs::read_to_string(entry_path(name, id))
        .with_context(|| format!("reading entry {id} for {name}"))?;
    Ok(serde_json::from_str(&raw)?)
}

pub fn read_all_entries(name: &str) -> Result<Vec<StorageEntry>> {
    let index = read_index(name)?;
    let mut entries = Vec::with_capacity(index.entries.len());
    for e in &index.entries {
        if let Ok(entry) = read_entry(name, e.id) {
            entries.push(entry);
        }
    }
    Ok(entries)
}

pub fn create_entry(name: &str, title: &str, content: &str, tags: &[String]) -> Result<StorageEntry> {
    let mut index = read_index(name)?;
    let id = index.next_id;
    index.next_id += 1;

    let now = timestamp();
    let entry = StorageEntry {
        id,
        title: title.to_owned(),
        content: content.to_owned(),
        tags: if tags.is_empty() { None } else { Some(tags.to_vec()) },
        updated_at: now.clone(),
    };

    fs::write(entry_path(name, id), serde_json::to_string_pretty(&entry)?)?;

    index.entries.push(IndexEntry {
        id,
        title: title.to_owned(),
        tags: entry.tags.clone(),
        updated_at: now,
    });
    fs::write(index_path(name), serde_json::to_string_pretty(&index)?)?;

    Ok(entry)
}

pub fn update_entry(name: &str, id: u32, title: &str, content: &str, tags: &[String]) -> Result<StorageEntry> {
    let mut index = read_index(name)?;
    let now = timestamp();

    let entry = StorageEntry {
        id,
        title: title.to_owned(),
        content: content.to_owned(),
        tags: if tags.is_empty() { None } else { Some(tags.to_vec()) },
        updated_at: now.clone(),
    };

    fs::write(entry_path(name, id), serde_json::to_string_pretty(&entry)?)?;

    if let Some(e) = index.entries.iter_mut().find(|e| e.id == id) {
        e.title = title.to_owned();
        e.tags = entry.tags.clone();
        e.updated_at = now;
    }
    fs::write(index_path(name), serde_json::to_string_pretty(&index)?)?;

    Ok(entry)
}

pub fn delete_entry(name: &str, id: u32) -> Result<()> {
    let mut index = read_index(name)?;
    let path = entry_path(name, id);
    let _ = fs::remove_file(&path);

    index.entries.retain(|e| e.id != id);
    fs::write(index_path(name), serde_json::to_string_pretty(&index)?)?;

    Ok(())
}

pub fn search_entries(name: &str, query: &str) -> Result<Vec<StorageEntry>> {
    let q = query.to_lowercase();
    let all = read_all_entries(name)?;
    Ok(all
        .into_iter()
        .filter(|e| {
            e.title.to_lowercase().contains(&q)
                || e.content.to_lowercase().contains(&q)
                || e.tags.as_ref().is_some_and(|t| t.iter().any(|t| t.to_lowercase().contains(&q)))
        })
        .collect())
}

fn timestamp() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}
