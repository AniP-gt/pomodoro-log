use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};

#[derive(Debug, Clone, serde::Serialize)]
pub struct TimerState {
    pub phase: String,
    pub time_left: u32,
    pub is_active: bool,
    pub work_count: u32,
}

struct AppState {
    tray_title: Mutex<String>,
    timer_state: Mutex<TimerState>,
    timer_running: Mutex<bool>,
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
fn get_timer_state(state: State<AppState>) -> TimerState {
    state.timer_state.lock().unwrap().clone()
}

#[tauri::command]
fn start_timer(
    app_handle: tauri::AppHandle,
    state: State<AppState>,
    work_time: u32,
    short_break: u32,
    long_break: u32,
    long_break_interval: u32,
) -> Result<(), String> {
    let mut running = state.timer_running.lock().unwrap();
    if *running {
        return Ok(());
    }
    *running = true;
    drop(running);

    let mut timer = state.timer_state.lock().unwrap();
    timer.is_active = true;
    timer.phase = "work".to_string();
    timer.time_left = work_time * 60;
    timer.work_count = 0;
    drop(timer);

    let app_handle_clone = app_handle.clone();
    let timer_state_inner = state.timer_state.lock().unwrap().clone();
    let timer_running_inner = state.timer_running.lock().unwrap().clone();
    let timer_state_arc = Arc::new(Mutex::new(timer_state_inner));
    let timer_running_arc = Arc::new(Mutex::new(timer_running_inner));
    let work_time_sec = work_time * 60;
    let short_break_sec = short_break * 60;
    let long_break_sec = long_break * 60;

    std::thread::spawn(move || {
        let mut current_phase = "work".to_string();
        let mut time_left = work_time_sec;
        let mut work_count = 0;

        loop {
            std::thread::sleep(Duration::from_secs(1));

            let running = timer_running_arc.lock().unwrap();
            if !*running {
                break;
            }
            drop(running);

            if time_left > 0 {
                time_left -= 1;
                let mut state_guard = timer_state_arc.lock().unwrap();
                state_guard.time_left = time_left;
                state_guard.phase = current_phase.clone();
                let _ = app_handle_clone.emit(
                    "timer-tick",
                    TimerState {
                        phase: current_phase.clone(),
                        time_left,
                        is_active: true,
                        work_count,
                    },
                );
                drop(state_guard);

                let title = format!(
                    "[{:02}:{:02}] {}",
                    time_left / 60,
                    time_left % 60,
                    if current_phase == "work" {
                        "W"
                    } else if current_phase == "shortBreak" {
                        "SB"
                    } else {
                        "LB"
                    }
                );
                if let Some(tray) = app_handle_clone.tray_by_id("main-tray") {
                    let _ = tray.set_title(Some(&title));
                }
            } else {
                let mut state_guard = timer_state_arc.lock().unwrap();

                if current_phase == "work" {
                    work_count += 1;
                    state_guard.work_count = work_count;

                    let _ = app_handle_clone.emit(
                        "timer-phase-end",
                        serde_json::json!({
                            "phase": "work",
                            "completed": work_count
                        }),
                    );

                    if work_count % long_break_interval == 0 {
                        current_phase = "longBreak".to_string();
                        time_left = long_break_sec;
                    } else {
                        current_phase = "shortBreak".to_string();
                        time_left = short_break_sec;
                    }
                } else {
                    let _ = app_handle_clone.emit(
                        "timer-phase-end",
                        serde_json::json!({
                            "phase": current_phase,
                            "completed": work_count
                        }),
                    );

                    current_phase = "work".to_string();
                    time_left = work_time_sec;
                }

                state_guard.phase = current_phase.clone();
                state_guard.time_left = time_left;
                drop(state_guard);
            }
        }

        let mut state_guard = timer_state_arc.lock().unwrap();
        state_guard.is_active = false;
    });

    Ok(())
}

#[tauri::command]
fn pause_timer(state: State<AppState>) {
    let mut running = state.timer_running.lock().unwrap();
    *running = false;
}

#[tauri::command]
fn reset_timer(state: State<AppState>, work_time: u32) {
    let mut running = state.timer_running.lock().unwrap();
    *running = false;
    drop(running);

    let mut timer = state.timer_state.lock().unwrap();
    timer.phase = "work".to_string();
    timer.time_left = work_time * 60;
    timer.is_active = false;
    timer.work_count = 0;
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
            timer_state: Mutex::new(TimerState {
                phase: "work".to_string(),
                time_left: 25 * 60,
                is_active: false,
                work_count: 0,
            }),
            timer_running: Mutex::new(false),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

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
            play_sound,
            get_timer_state,
            start_timer,
            pause_timer,
            reset_timer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
