#[cfg(target_os = "macos")]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
fn open_settings_window(app: tauri::AppHandle, title: Option<String>) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    let win_title = title.unwrap_or_else(|| "Pupitre Preferences".to_string());

    WebviewWindowBuilder::new(
        &app,
        "settings",
        WebviewUrl::App("index.html?view=settings".into()),
    )
    .title(win_title)
    .inner_size(720.0, 560.0)
    .min_inner_size(540.0, 440.0)
    .resizable(true)
    .center()
    .decorations(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .on_permission_request(|_webview, _kind| tauri::webview::PermissionResponse::Allow)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let handle = app.handle();

                let pref_item = MenuItem::with_id(
                    handle,
                    "preferences",
                    "Preferences…",
                    true,
                    Some("CmdOrCtrl+,"),
                )?;

                let app_menu = Submenu::with_items(
                    handle,
                    "Pupitre",
                    true,
                    &[
                        &PredefinedMenuItem::about(handle, Some("About Pupitre"), None)?,
                        &PredefinedMenuItem::separator(handle)?,
                        &pref_item,
                        &PredefinedMenuItem::separator(handle)?,
                        &PredefinedMenuItem::services(handle, None)?,
                        &PredefinedMenuItem::separator(handle)?,
                        &PredefinedMenuItem::hide(handle, None)?,
                        &PredefinedMenuItem::hide_others(handle, None)?,
                        &PredefinedMenuItem::show_all(handle, None)?,
                        &PredefinedMenuItem::separator(handle)?,
                        &PredefinedMenuItem::quit(handle, None)?,
                    ],
                )?;

                let new_item = MenuItem::with_id(
                    handle,
                    "new_doc",
                    "New Document",
                    true,
                    Some("CmdOrCtrl+N"),
                )?;
                let open_item =
                    MenuItem::with_id(handle, "open_doc", "Open...", true, Some("CmdOrCtrl+O"))?;
                let save_item =
                    MenuItem::with_id(handle, "save_doc", "Save", true, Some("CmdOrCtrl+S"))?;

                let file_menu = Submenu::with_items(
                    handle,
                    "File",
                    true,
                    &[
                        &new_item,
                        &open_item,
                        &save_item,
                        &PredefinedMenuItem::separator(handle)?,
                        &PredefinedMenuItem::close_window(handle, None)?,
                    ],
                )?;

                let edit_menu = Submenu::with_items(
                    handle,
                    "Edit",
                    true,
                    &[
                        &PredefinedMenuItem::undo(handle, None)?,
                        &PredefinedMenuItem::redo(handle, None)?,
                        &PredefinedMenuItem::separator(handle)?,
                        &PredefinedMenuItem::cut(handle, None)?,
                        &PredefinedMenuItem::copy(handle, None)?,
                        &PredefinedMenuItem::paste(handle, None)?,
                        &PredefinedMenuItem::select_all(handle, None)?,
                    ],
                )?;

                let window_menu = Submenu::with_items(
                    handle,
                    "Window",
                    true,
                    &[
                        &PredefinedMenuItem::minimize(handle, None)?,
                        &PredefinedMenuItem::fullscreen(handle, None)?,
                        &PredefinedMenuItem::separator(handle)?,
                        &PredefinedMenuItem::close_window(handle, None)?,
                    ],
                )?;

                let menu =
                    Menu::with_items(handle, &[&app_menu, &file_menu, &edit_menu, &window_menu])?;
                app.set_menu(menu)?;
            }

            #[cfg(not(target_os = "macos"))]
            let _ = app;

            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "new_doc" => {
                let _ = app.emit("menu-action", "new");
            }
            "open_doc" => {
                let _ = app.emit("menu-action", "open");
            }
            "save_doc" => {
                let _ = app.emit("menu-action", "save");
            }
            "preferences" => {
                let _ = open_settings_window(app.clone(), None);
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![open_settings_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
