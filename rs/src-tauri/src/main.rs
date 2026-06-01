fn main() {
    let log_path = std::env::temp_dir().join("memlink-gui.log");
    let _ = std::fs::write(&log_path, "memlink-gui starting...\n");

    std::panic::set_hook(Box::new(move |info| {
        let msg = format!("panic: {info}\n");
        let _ = std::fs::write(&log_path, &msg);
    }));

    memlink_gui_lib::run();
}
