#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "windows")]
    {
        // Allow third-party font smoothers / hookers like MacType (EasyHook) to inject into
        // the WebView2 renderer process by disabling Chromium's RendererCodeIntegrity mitigation.
        let existing_args =
            std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
        let font_args = "--disable-features=RendererCodeIntegrity,msWebOOUI,msPdfOOUI,msSmartScreenProtection --enable-font-antialiasing";
        let combined = if existing_args.is_empty() {
            font_args.to_string()
        } else {
            format!("{} {}", existing_args, font_args)
        };
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", combined);
    }

    pupitre_lib::run();
}
