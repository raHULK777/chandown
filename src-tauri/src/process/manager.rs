use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct ProcessManager;

impl ProcessManager {
    pub fn get_cookies_args() -> Vec<String> {
        // Firefox is the only browser that works reliably on Windows.
        // Chromium browsers (Chrome/Edge/Brave) use app-bound encryption and
        // exclusive DB locks — their cookies cannot be read by yt-dlp at all.
        let ff_path = std::env::var("APPDATA")
            .map(|base| PathBuf::from(base).join(r"Mozilla\Firefox"))
            .unwrap_or_default();
        if ff_path.exists() {
            return vec!["--cookies-from-browser=firefox".to_string()];
        }
        Vec::new()
    }

    pub fn find_tool(name: &str) -> bool {
        Self::find_tool_path(name).is_some()
    }

    pub fn find_tool_path(name: &str) -> Option<PathBuf> {
        if cfg!(target_os = "windows") {
            let name_exe = format!("{}.exe", name);
            if let Ok(output) = Command::new("where")
                .creation_flags(CREATE_NO_WINDOW)
                .arg(&name_exe)
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout)
                        .lines()
                        .next()
                        .map(|s| s.trim().to_string());
                    if let Some(p) = path {
                        if !p.is_empty() {
                            return Some(PathBuf::from(p));
                        }
                    }
                }
            }
            None
        } else {
            let output = Command::new("which").arg(name).output().ok()?;
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).lines().next().map(|s| s.trim().to_string())?;
                if !path.is_empty() {
                    return Some(PathBuf::from(path));
                }
            }
            None
        }
    }

    pub fn run_simple(program: &str, args: &[&str]) -> Result<String, String> {
        let output = Command::new(program)
            .creation_flags(CREATE_NO_WINDOW)
            .args(args)
            .output()
            .map_err(|e| format!("Failed to execute {}: {}", program, e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            Ok(stdout)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Err(format!("{} failed: {}", program, stderr))
        }
    }

    #[allow(dead_code)]
    pub fn spawn_detached(program: &str, args: &[&str]) -> Result<std::process::Child, String> {
        Command::new(program)
            .creation_flags(CREATE_NO_WINDOW)
            .args(args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn {}: {}", program, e))
    }

    pub fn download_ytdlp(target_dir: &std::path::Path) -> Result<PathBuf, String> {
        let target = target_dir.join("yt-dlp.exe");
        if target.exists() {
            return Ok(target);
        }

        let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
        let status = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args([
                "-NoProfile",
                "-Command",
                &format!("Invoke-WebRequest -Uri '{}' -OutFile '{}'", url, target.display()),
            ])
            .status()
            .map_err(|e| format!("Failed to start download: {}", e))?;

        if !status.success() {
            return Err("Failed to download yt-dlp.exe".to_string());
        }

        if !target.exists() {
            return Err("yt-dlp.exe not found after download".to_string());
        }

        Ok(target)
    }

    pub fn download_ffmpeg(target_dir: &std::path::Path) -> Result<PathBuf, String> {
        let ffmpeg_exe = target_dir.join("ffmpeg.exe");
        if ffmpeg_exe.exists() {
            return Ok(ffmpeg_exe);
        }

        let zip_path = target_dir.join("ffmpeg.zip");
        let url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";

        let download_cmd = format!(
            "Invoke-WebRequest -Uri '{}' -OutFile '{}'",
            url,
            zip_path.display()
        );
        let status = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["-NoProfile", "-Command", &download_cmd])
            .status()
            .map_err(|e| format!("Failed to start FFmpeg download: {}", e))?;

        if !status.success() {
            return Err("Failed to download FFmpeg".to_string());
        }

        let extract_cmd = format!(
            "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
            zip_path.display(),
            target_dir.display()
        );
        let status = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["-NoProfile", "-Command", &extract_cmd])
            .status()
            .map_err(|e| format!("Failed to extract FFmpeg: {}", e))?;

        if !status.success() {
            let _ = std::fs::remove_file(&zip_path);
            return Err("Failed to extract FFmpeg archive".to_string());
        }

        let _ = std::fs::remove_file(&zip_path);

        let extracted = target_dir.join("ffmpeg-release-essentials").join("bin").join("ffmpeg.exe");
        if extracted.exists() {
            std::fs::rename(&extracted, &ffmpeg_exe)
                .map_err(|e| format!("Failed to move ffmpeg.exe: {}", e))?;
            let _ = std::fs::remove_dir_all(target_dir.join("ffmpeg-release-essentials"));
            return Ok(ffmpeg_exe);
        }

        if let Ok(entries) = std::fs::read_dir(target_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() && path.file_name().map_or(false, |n| n.to_string_lossy().contains("ffmpeg")) {
                    let bin = path.join("bin").join("ffmpeg.exe");
                    if bin.exists() {
                        std::fs::rename(&bin, &ffmpeg_exe)
                            .map_err(|e| format!("Failed to move ffmpeg.exe: {}", e))?;
                        let _ = std::fs::remove_dir_all(&path);
                        return Ok(ffmpeg_exe);
                    }
                }
            }
        }

        Err("FFmpeg binary not found after extraction".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_tool_nonexistent() {
        assert!(!ProcessManager::find_tool("this_tool_definitely_does_not_exist_12345"));
    }

    #[test]
    fn test_find_tool_cmd_exists() {
        assert!(ProcessManager::find_tool("cmd"));
    }

    #[test]
    fn test_run_simple_echo() {
        let result = ProcessManager::run_simple("cmd", &["/C", "echo", "hello"]);
        assert!(result.is_ok());
        assert!(result.unwrap().contains("hello"));
    }

    #[test]
    fn test_run_simple_nonexistent_program() {
        let result = ProcessManager::run_simple("nonexistent_program_xyz", &[]);
        assert!(result.is_err());
    }

    #[test]
    fn test_run_simple_failing_command() {
        let result = ProcessManager::run_simple("cmd", &["/C", "exit", "1"]);
        assert!(result.is_err());
    }

    #[test]
    fn test_spawn_detached_nonexistent() {
        let result = ProcessManager::spawn_detached("nonexistent_program_xyz", &[]);
        assert!(result.is_err());
    }

    #[test]
    fn test_spawn_detached_cmd() {
        let result = ProcessManager::spawn_detached("cmd", &["/C", "echo", "test"]);
        assert!(result.is_ok());
        let mut child = result.unwrap();
        let status = child.wait();
        assert!(status.is_ok());
        assert!(status.unwrap().success());
    }
}
