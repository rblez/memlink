use eframe::egui;
use crate::types::*;
use crate::storage;

#[derive(Default)]
pub struct MemlinkApp {
    // data
    memories: Vec<UniversalMemory>,
    selected_memory: Option<usize>,
    entries: Vec<StorageEntry>,
    selected_entry: Option<usize>,

    // edit state
    editing: bool,
    edit_title: String,
    edit_content: String,
    edit_tags: String,
    edit_id: Option<u32>,

    // search
    search_query: String,

    // ui state
    status: String,
    error: Option<String>,
}

impl MemlinkApp {
    pub fn new() -> Self {
        let mut app = Self::default();
        app.refresh();
        app
    }

    fn refresh(&mut self) {
        self.memories = match storage::load_config() {
            Ok(c) => c.universal_memories,
            Err(e) => {
                self.error = Some(format!("config: {e}"));
                return;
            }
        };
        self.selected_memory = None;
        self.entries.clear();
        self.selected_entry = None;
    }

    fn select_memory(&mut self, idx: usize) {
        self.selected_memory = Some(idx);
        self.selected_entry = None;
        self.editing = false;
        self.search_query.clear();

        if let Some(mem) = self.memories.get(idx) {
            match storage::read_all_entries(&mem.memory_name) {
                Ok(e) => self.entries = e,
                Err(e) => self.error = Some(format!("entries: {e}")),
            }
        }
    }

    fn save_entry(&mut self) {
        let name = match self.memories.get(self.selected_memory.unwrap_or(0)) {
            Some(m) => m.memory_name.clone(),
            None => return,
        };
        let tags: Vec<String> = self.edit_tags.split(',')
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty())
            .collect();

        let result = if let Some(id) = self.edit_id {
            storage::update_entry(&name, id, &self.edit_title, &self.edit_content, &tags)
        } else {
            storage::create_entry(&name, &self.edit_title, &self.edit_content, &tags)
        };

        match result {
            Ok(_) => {
                self.editing = false;
                self.status = format!("Saved: {}", self.edit_title);
                self.select_memory(self.selected_memory.unwrap_or(0));
            }
            Err(e) => self.error = Some(format!("save: {e}")),
        }
    }

    fn delete_selected_entry(&mut self) {
        let (name, id) = match self.selected_entry {
            Some(idx) => {
                let name = self.memories[self.selected_memory.unwrap()].memory_name.clone();
                (name, self.entries[idx].id)
            }
            None => return,
        };
        if storage::delete_entry(&name, id).is_ok() {
            self.selected_entry = None;
            self.select_memory(self.selected_memory.unwrap());
            self.status = "Entry deleted".into();
        }
    }

    fn start_new_entry(&mut self) {
        self.edit_id = None;
        self.edit_title.clear();
        self.edit_content.clear();
        self.edit_tags.clear();
        self.editing = true;
    }

    fn start_edit_entry(&mut self, idx: usize) {
        if let Some(e) = self.entries.get(idx) {
            self.edit_id = Some(e.id);
            self.edit_title = e.title.clone();
            self.edit_content = e.content.clone();
            self.edit_tags = e.tags.as_ref()
                .map(|t| t.join(", "))
                .unwrap_or_default();
            self.editing = true;
        }
    }
}

impl eframe::App for MemlinkApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // ── Top bar ────────────────────────────────────────
        egui::TopBottomPanel::top("top_bar").show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.heading("memlink");
                ui.separator();

                if ui.button("↻").clicked() {
                    self.refresh();
                }

                if self.selected_memory.is_some() {
                    ui.separator();
                    let resp = ui.add_sized(
                        [200.0, 20.0],
                        egui::TextEdit::singleline(&mut self.search_query)
                            .hint_text("search..."),
                    );
                    if resp.changed() || resp.lost_focus() {
                        if let Some(mem) = self.selected_memory
                            .and_then(|i| self.memories.get(i))
                        {
                            if self.search_query.is_empty() {
                                let _ = storage::read_all_entries(&mem.memory_name)
                                    .map(|e| self.entries = e);
                            } else {
                                let _ = storage::search_entries(&mem.memory_name, &self.search_query)
                                    .map(|e| self.entries = e);
                            }
                        }
                    }

                    if ui.button("+ New").clicked() {
                        self.start_new_entry();
                    }
                }

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if !self.status.is_empty() {
                        ui.label(&self.status);
                    }
                });
            });
        });

        // ── Left panel: memories ───────────────────────────
        egui::SidePanel::left("memories")
            .resizable(true)
            .default_width(180.0)
            .show(ctx, |ui| {
                ui.strong("Memories");
                ui.separator();

                if self.memories.is_empty() {
                    ui.label("no memories");
                }

                for i in 0..self.memories.len() {
                    let selected = self.selected_memory == Some(i);
                    let label = {
                        let mem = &self.memories[i];
                        format!("{}  ({})", mem.memory_name, mem.memory_id.get(..6).unwrap_or("?"))
                    };

                    if ui.selectable_label(selected, &label).clicked() {
                        self.select_memory(i);
                    }
                }
            });

        // ── Central panel ──────────────────────────────────
        egui::CentralPanel::default().show(ctx, |ui| {
            if self.editing {
                self.show_edit_panel(ui);
            } else if let Some(idx) = self.selected_entry {
                self.show_entry_detail(ui, idx);
            } else {
                self.show_entry_list(ui);
            }
        });

        // ── Error dialog ───────────────────────────────────
        if let Some(err) = self.error.take() {
            egui::Window::new("Error")
                .collapsible(false)
                .show(ctx, |ui| {
                    ui.label(err);
                    if ui.button("Ok").clicked() {
                        // error already consumed
                    }
                });
        }
    }
}

impl MemlinkApp {
    fn show_entry_list(&mut self, ui: &mut egui::Ui) {
        if self.entries.is_empty() {
            ui.vertical_centered(|ui| {
                ui.add_space(40.0);
                ui.label("No entries");
                if ui.button("+ Create first entry").clicked() {
                    self.start_new_entry();
                }
            });
            return;
        }

        egui::ScrollArea::vertical().show(ui, |ui| {
            for (i, entry) in self.entries.iter().enumerate() {
                let preview: String = entry.content.chars().take(80).collect();
                let tags = entry.tags.as_ref()
                    .map(|t| format!(" [{}]", t.join(", ")))
                    .unwrap_or_default();

                let resp = ui.selectable_label(
                    self.selected_entry == Some(i),
                    format!("#{} {}  {tags}\n{}", entry.id, entry.title, preview),
                );

                if resp.clicked() {
                    self.selected_entry = Some(i);
                }
                ui.separator();
            }
        });
    }

    fn show_entry_detail(&mut self, ui: &mut egui::Ui, idx: usize) {
        if idx >= self.entries.len() { return; }
        let title = self.entries[idx].title.clone();
        let tags = self.entries[idx].tags.clone();
        let content = self.entries[idx].content.clone();
        let updated_at = self.entries[idx].updated_at.clone();

        let mut clicked_edit = false;
        let mut clicked_delete = false;

        ui.horizontal(|ui| {
            ui.strong(&title);
            if ui.button("✎ edit").clicked() { clicked_edit = true; }
            if ui.button("✕ delete").clicked() { clicked_delete = true; }
        });

        if clicked_edit { self.start_edit_entry(idx); }
        if clicked_delete { self.delete_selected_entry(); }

        if let Some(tags) = &tags {
            if !tags.is_empty() {
                ui.label(format!("tags: {}", tags.join(", ")));
            }
        }

        ui.separator();
        egui::ScrollArea::vertical().show(ui, |ui| {
            ui.label(&content);
        });

        ui.with_layout(egui::Layout::bottom_up(egui::Align::LEFT), |ui| {
            ui.label(format!("Updated: {}", updated_at.get(..10).unwrap_or("?")));
        });
    }

    fn show_edit_panel(&mut self, ui: &mut egui::Ui) {
        ui.strong(if self.edit_id.is_some() { "Edit Entry" } else { "New Entry" });
        ui.separator();

        egui::Grid::new("edit_form").num_columns(2).show(ui, |ui| {
            ui.label("Title:");
            ui.text_edit_singleline(&mut self.edit_title);
            ui.end_row();

            ui.label("Tags (comma):");
            ui.text_edit_singleline(&mut self.edit_tags);
            ui.end_row();

            ui.label("Content:");
            ui.end_row();
        });

        egui::ScrollArea::vertical()
            .max_height(300.0)
            .show(ui, |ui| {
                ui.add_sized(
                    ui.available_size(),
                    egui::TextEdit::multiline(&mut self.edit_content)
                        .hint_text("plain text content..."),
                );
            });

        ui.horizontal(|ui| {
            if ui.button("💾 Save").clicked() {
                self.save_entry();
            }
            if ui.button("Cancel").clicked() {
                self.editing = false;
            }
        });
    }
}
