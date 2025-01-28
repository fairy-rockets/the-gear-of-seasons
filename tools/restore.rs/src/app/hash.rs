use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use tracing::info;
use crate::app;

fn walk<F>(path: &Path, mut f: F)
  where F: FnMut(&str, PathBuf) -> anyhow::Result<()>
{
  let ext_jpgs = HashSet::from([
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
    if !ext_jpgs.contains(&ext) {
      continue;
    }
    let content = std::fs::read(path);
    let Ok(content) = content else {
      tracing::warn!("Failed to read content: {}, err={:?}", path.display(), entry.file_name());
      continue;
    };
    let hash = format!("{:x}", md5::compute(content));
    tracing::info!("{}: {}", path.display(), &hash);
    match f(&hash, path.to_path_buf()) {
      Ok(_) => {},
      Err(err) => {
        tracing::error!("{}: {}", path.display(), err);
      },
    };
  }
}

pub fn run(m: &clap::ArgMatches) -> anyhow::Result<()> {
  let input = m.get_one::<String>("INPUT").expect("[BUG] No INPUT");
  let output = m.get_one::<String>("OUTPUT").expect("[BUG] No OUTPUT");
  let storage = m.get_one::<String>("STORAGE").expect("[BUG] No PATH");
  info!("input: {}", input);
  info!("output: {}", output);
  info!("storage: {}", storage);

  // Read the input hashes
  info!("[{}] reading input file.", input);
  let (mut images, duration) = {
    let beg = std::time::Instant::now();
    let content = std::fs::read_to_string(input)?;
    let mut images = std::collections::HashSet::new();
    for id in content.split("\n") {
      images.insert(id.to_string());
    }
    let end = std::time::Instant::now();
    (images, end.duration_since(beg))
  };
  info!("[{}] {} images, took {} [ms]", input, images.len(), duration.as_millis());

  // Walk the storage dir.
  std::fs::create_dir_all(output)?;
  app::hash::walk(Path::new(storage), |hash, path| {
    if !images.contains(hash) {
      return Ok(());
    }
    let d1 = &hash[0..2];
    let d2 = &hash[2..4];
    let d3 = &hash[4..6];
    let f = &hash[6..];
    let dst = Path::new(output).join(d1).join(d2).join(d3);
    std::fs::create_dir_all(dst.clone())?;
    std::fs::copy(path, dst.join(f))?;
    images.remove(hash);
    Ok(())
  });

  // Copy to the output.
  for hash in images {
    info!("image with hash={} not found", hash);
  }

  Ok(())
}
