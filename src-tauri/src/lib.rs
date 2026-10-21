#[cfg(target_os = "macos")]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle, title: Option<String>) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    let win_title = title.unwrap_or_else(|| "Pupitre Preferences".to_string());

    let win = WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("index.html#settings".into()))
        .title(win_title)
        .inner_size(720.0, 560.0)
        .min_inner_size(540.0, 440.0)
        .resizable(true)
        .center()
        .decorations(false)
        .shadow(true)
        .additional_browser_args(
            "--disable-features=RendererCodeIntegrity,msWebOOUI,msPdfOOUI,msSmartScreenProtection --enable-font-antialiasing",
        )
        .build()
        .map_err(|e| e.to_string())?;

    let win_clone = win.clone();
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = win_clone.hide();
        }
    });

    let _ = win.show();
    let _ = win.set_focus();
    Ok(())
}

#[tauri::command]
async fn open_about_window(app: tauri::AppHandle, title: Option<String>) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("about") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    let win_title = title.unwrap_or_else(|| "About Pupitre".to_string());

    let win = WebviewWindowBuilder::new(&app, "about", WebviewUrl::App("index.html#about".into()))
        .title(win_title)
        .inner_size(480.0, 360.0)
        .min_inner_size(420.0, 320.0)
        .resizable(false)
        .center()
        .decorations(false)
        .shadow(true)
        .additional_browser_args(
            "--disable-features=RendererCodeIntegrity,msWebOOUI,msPdfOOUI,msSmartScreenProtection --enable-font-antialiasing",
        )
        .build()
        .map_err(|e| e.to_string())?;

    let win_clone = win.clone();
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = win_clone.hide();
        }
    });

    let _ = win.show();
    let _ = win.set_focus();
    Ok(())
}

#[tauri::command]
async fn set_menu_items_enabled(
    app: tauri::AppHandle,
    items: std::collections::HashMap<String, bool>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Some(menu) = app.menu() {
            for (id, enabled) in items {
                if let Some(item) = menu.get(&id) {
                    if let Some(menu_item) = item.as_menuitem() {
                        let _ = menu_item.set_enabled(enabled);
                    }
                }
            }
        }
    }
    let _ = app;
    let _ = items;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .on_permission_request(|_webview, _kind| tauri::webview::PermissionResponse::Allow)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if let Some(settings_win) = app.get_webview_window("settings") {
                let win_clone = settings_win.clone();
                settings_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });
            }

            if let Some(about_win) = app.get_webview_window("about") {
                let win_clone = about_win.clone();
                about_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });
            }

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
                    MenuItem::with_id(handle, "save_doc", "Save", false, Some("CmdOrCtrl+S"))?;
                let export_pdf_item = MenuItem::with_id(
                    handle,
                    "export_pdf",
                    "Export as PDF…",
                    false,
                    None::<&str>,
                )?;

                let file_menu = Submenu::with_items(
                    handle,
                    "File",
                    true,
                    &[
                        &new_item,
                        &open_item,
                        &save_item,
                        &export_pdf_item,
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
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id == "preferences" {
                let handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = open_settings_window(handle, None).await;
                });
            } else {
                let _ = app.emit("menu-action", id);
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_settings_window,
            open_about_window,
            set_menu_items_enabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
