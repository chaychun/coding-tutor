use rand::Rng;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::ShellExt;

// Sidecar state shared across commands
struct SidecarState {
    port: u16,
    auth_token: String,
    running: bool,
}

struct AppState {
    sidecar: Mutex<SidecarState>,
}

#[derive(Serialize)]
struct SidecarInfo {
    port: u16,
    auth_token: String,
}

#[derive(Serialize)]
struct SidecarStatus {
    running: bool,
    port: u16,
}

// Generate a random auth token
fn generate_auth_token() -> String {
    let mut rng = rand::thread_rng();
    (0..32)
        .map(|_| {
            let idx = rng.gen_range(0..36);
            if idx < 10 {
                (b'0' + idx) as char
            } else {
                (b'a' + idx - 10) as char
            }
        })
        .collect()
}

// Find an available port
fn find_available_port() -> u16 {
    portpicker::pick_unused_port().unwrap_or(3456)
}

#[tauri::command]
fn get_sidecar_info(state: State<AppState>) -> Result<SidecarInfo, String> {
    let sidecar = state.sidecar.lock().map_err(|e| e.to_string())?;
    Ok(SidecarInfo {
        port: sidecar.port,
        auth_token: sidecar.auth_token.clone(),
    })
}

#[tauri::command]
fn get_sidecar_status(state: State<AppState>) -> Result<SidecarStatus, String> {
    let sidecar = state.sidecar.lock().map_err(|e| e.to_string())?;
    Ok(SidecarStatus {
        running: sidecar.running,
        port: sidecar.port,
    })
}

#[tauri::command]
fn store_api_key(app: AppHandle, key: String) -> Result<(), String> {
    // Store API key in the app's config dir as a simple file for now.
    // In production, Stronghold would be used, but that requires additional
    // setup (password, salt). For the initial implementation, we use the
    // app data directory which is already platform-specific and user-private.
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create dir: {}", e))?;

    let key_path = data_dir.join(".api_key");
    std::fs::write(&key_path, &key).map_err(|e| format!("Failed to write API key: {}", e))?;

    // Set restrictive permissions on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&key_path, perms)
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn has_api_key(app: AppHandle) -> Result<bool, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let key_path = data_dir.join(".api_key");
    Ok(key_path.exists())
}

fn read_api_key(app: &AppHandle) -> Option<String> {
    let data_dir = app.path().app_data_dir().ok()?;
    let key_path = data_dir.join(".api_key");
    std::fs::read_to_string(key_path).ok()
}

fn spawn_sidecar(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let port = find_available_port();
    let auth_token = generate_auth_token();

    // Get database path
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create dir: {}", e))?;
    let db_path = data_dir.join("data.db");

    // Read API key
    let api_key = read_api_key(app).unwrap_or_default();

    // Spawn sidecar using Tauri shell plugin
    let shell = app.shell();
    let sidecar_command = shell
        .sidecar("coding-tutor-sidecar")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .env("PORT", port.to_string())
        .env("AUTH_TOKEN", auth_token.clone())
        .env("DATABASE_PATH", db_path.to_string_lossy().to_string())
        .env("ANTHROPIC_API_KEY", api_key);

    let (_rx, _child) = sidecar_command
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    // Update state
    let mut sidecar = state.sidecar.lock().map_err(|e| e.to_string())?;
    sidecar.port = port;
    sidecar.auth_token = auth_token;
    sidecar.running = true;

    log::info!("Sidecar spawned on port {}", port);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        sidecar: Mutex::new(SidecarState {
            port: 0,
            auth_token: String::new(),
            running: false,
        }),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_sidecar_info,
            get_sidecar_status,
            store_api_key,
            has_api_key,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Spawn sidecar on startup
            let handle = app.handle().clone();
            let state = handle.state::<AppState>();
            if let Err(e) = spawn_sidecar(&handle, &state) {
                log::error!("Failed to spawn sidecar: {}", e);
                // Don't fail app startup — the frontend will show an error state
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
