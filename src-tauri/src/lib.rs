#[cfg(target_os = "macos")]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
                let _ = app.emit("menu-action", "preferences");
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
