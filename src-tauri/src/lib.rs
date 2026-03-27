use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};

struct AppState {
    tray_title: Mutex<String>,
}

#[tauri::command]
fn save_log(path: String, content: String, start_time: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);

    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let log_entry = format!(
        "## {} - {}\n{}\n\n",
        start_time,
        chrono::Local::now().format("%H:%M").to_string(),
        content
    );

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    file.write_all(log_entry.as_bytes())
        .map_err(|e| format!("Failed to write to file: {}", e))?;

    Ok(format!("Log saved to: {}", path))
}

#[tauri::command]
fn update_tray_title(title: String, app_handle: tauri::AppHandle, state: State<AppState>) {
    if let Some(tray) = app_handle.tray_by_id("main-tray") {
        let _ = tray.set_title(Some(&title));
    }
    *state.tray_title.lock().unwrap() = title;
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn play_sound(sound_name: String) -> Result<(), String> {
    use std::process::Command;

    log::info!("Playing sound: {}", sound_name);

    let output = Command::new("afplay")
        .arg(format!("/System/Library/Sounds/{}.aiff", sound_name))
        .output()
        .map_err(|e| format!("Failed to execute: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        log::error!("Sound failed: {}", stderr);
        return Err(format!("Sound failed: {}", stderr));
    }

    log::info!("Sound played successfully");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            tray_title: Mutex::new(String::new()),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let start_item = MenuItem::with_id(app, "start", "Start Timer", true, None::<&str>)?;
            let pause_item = MenuItem::with_id(app, "pause", "Pause Timer", true, None::<&str>)?;
            let reset_item = MenuItem::with_id(app, "reset", "Reset Timer", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &show_item,
                    &start_item,
                    &pause_item,
                    &reset_item,
                    &quit_item,
                ],
            )?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "start" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("tray-action", "start");
                        }
                    }
                    "pause" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("tray-action", "pause");
                        }
                    }
                    "reset" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("tray-action", "reset");
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_log,
            update_tray_title,
            get_app_version,
            play_sound
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
