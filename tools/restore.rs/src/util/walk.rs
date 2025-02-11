use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};

pub fn walk_images<P: AsRef<Path>, F>(path: P, mut f: F) -> anyhow::Result<()>
  where
    F: FnMut(&str, PathBuf) -> anyhow::Result<()>
{
  let ext_images = HashSet::from([
    OsStr::new("jpg").to_os_string(),
    OsStr::new("jpeg").to_os_string(),
    OsStr::new("png").to_os_string(),
  ]);
  for entry in walkdir::WalkDir::new(path) {
    let Ok(entry) = entry else {
      continue;
    };
    if !entry.file_type().is_file() {
      continue;
    }
    let path = entry.path();
    let ext = path.extension();
    let Some(ext) = ext else {
      continue;
    };
    let ext = ext.to_ascii_lowercase();
    if !ext_images.contains(&ext) {
      continue;
    }
    let content = std::fs::read(path);
    let Ok(content) = content else {
      tracing::warn!("Failed to read content: {}, err={:?}", path.display(), entry.file_name());
      continue;
    };
    let hash = format!("{:x}", md5::compute(content));
    match f(&hash, path.to_path_buf()) {
      Ok(_) => {},
      Err(err) => {
        return Err(err);
      },
    };
  }
  Ok(())
}
