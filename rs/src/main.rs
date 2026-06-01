mod types;
mod storage;
#[cfg(feature = "mcp")]
mod mcp;
mod app;

use eframe::egui;
use app::MemlinkApp;

fn main() -> eframe::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let mcp_mode = args.iter().any(|a| a == "--mcp");

    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("memlink")
            .with_inner_size([960.0, 640.0]),
        ..Default::default()
    };

    eframe::run_native(
        "memlink",
        options,
        Box::new(|_cc| Ok(Box::new(MemlinkApp::new()))),
    )
}
