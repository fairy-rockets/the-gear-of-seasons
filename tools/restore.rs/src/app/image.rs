use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tracing::{info, warn};

pub fn run(m: &clap::ArgMatches) -> anyhow::Result<()> {
  let md5_map = m.get_one::<String>("MD5_MAP").expect("[BUG] No INPUT");
  let ahash_map = m.get_one::<String>("AHASH_MAP").expect("[BUG] No INPUT");
  let medium_path = m.get_one::<String>("MEDIUM").expect("[BUG] No MEDIUM PATH");
  let original_path = m.get_one::<String>("ORIGINAL").expect("[BUG] No ORIGINAL PATH");
  let dest = m.get_one::<String>("DESTINATION").expect("[BUG] No DESTINATION");
  info!("md5 map: {}", md5_map);
  info!("ahash map: {}", ahash_map);
  info!("original path: {}", original_path);
  info!("medium: {}", medium_path);
  info!("dest: {}", dest);

  let hasher = crate::util::make_hasher();

  // Read the input hashes
  let mut entities = crate::util::Entities::new();
  entities.load(md5_map)?;
  let mut originals = crate::util::Originals::new();
  originals.load(ahash_map)?;

  std::fs::create_dir_all(dest)?;

  // Walk the storage dir.
  let mut original_images = HashMap::<String, PathBuf>::new();

  crate::util::walk_images(original_path, |_, original_path| {
    let original_img = image::open(&original_path)?;
    let ahash = hasher.hash(&original_img);
    info!("[ORIG] Processing: {:?}", &original_path);
    original_images.insert(ahash.to_string(), original_path);
    Ok(())
  })?;

  crate::util::walk_images(original_path, |hash, medium_path| {
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
    let dst = Path::new(dest).join(d1).join(d2).join(d3);
    std::fs::create_dir_all(dst.clone())?;
    std::fs::copy(orig_path, dst.join(f))?;
    Ok(())
  })?;

  Ok(())
}
