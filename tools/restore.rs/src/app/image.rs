use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tracing::{info, warn};

pub fn run(m: &clap::ArgMatches) -> anyhow::Result<()> {
  let input = m.get_one::<String>("INPUT").expect("[BUG] No INPUT");
  let output = m.get_one::<String>("OUTPUT").expect("[BUG] No OUTPUT");
  let medium_path = m.get_one::<String>("MEDIUM").expect("[BUG] No PATH");
  let storage_path = m.get_one::<String>("STORAGE").expect("[BUG] No PATH");
  info!("input: {}", input);
  info!("output: {}", output);
  info!("medium: {}", medium_path);
  info!("storage: {}", storage_path);

  // Read the input hashes
  let mut entities = crate::util::Entities::new();
  entities.load(input)?;

  std::fs::create_dir_all(output)?;

  // Walk the storage dir.
  let mut original_images = HashMap::<String, PathBuf>::new();
  let hasher = imagehash::AverageHash::new()
    .with_image_size(512, 512)
    .with_hash_size(512, 512)
    .with_resizer(|img, w, h| {
      img.resize_exact(w as u32, h as u32, image::imageops::FilterType::Lanczos3)
    });

  crate::util::walk_images(storage_path, |_, original_path| {
    let original_img = image::open(&original_path)?;
    let ahash = hasher.hash(&original_img);
    info!("[ORIG] Processing: {:?}", &original_path);
    original_images.insert(ahash.to_string(), original_path);
    Ok(())
  })?;

  crate::util::walk_images(storage_path, |hash, medium_path| {
    let Some(hash) = entities.original_of(hash) else {
      warn!("[WARNING] No original image found for {}", hash);
      return Ok(());
    };
    let medium_img = image::open(medium_path)?;
    let ahash = hasher.hash(&medium_img).to_string();
    let Some(orig_path) = original_images.get(&ahash) else {
      return Ok(());
    };
    let d1 = &hash[0..2];
    let d2 = &hash[2..4];
    let d3 = &hash[4..6];
    let f = &hash[6..];
    let dst = Path::new(output).join(d1).join(d2).join(d3);
    std::fs::create_dir_all(dst.clone())?;
    std::fs::copy(orig_path, dst.join(f))?;
    Ok(())
  })?;

  Ok(())
}
