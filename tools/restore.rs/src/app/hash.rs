use std::path::Path;
use tracing::info;

pub fn run(m: &clap::ArgMatches) -> anyhow::Result<()> {
  let md5_map = m.get_one::<String>("MD5_MAP").expect("[BUG] No MD5_MAP");
  let original_path = m.get_one::<String>("ORIGINAL").expect("[BUG] No ORIGINAL");
  let dest = m.get_one::<String>("DESTINATION").expect("[BUG] No DESTINATION");
  info!("md5 map: {}", md5_map);
  info!("original path: {}", original_path);
  info!("destination: {}", dest);

  // Read the input hashes
  let mut entities = crate::util::Entities::new();
  info!("[{}] reading md5 map file.", md5_map);
  entities.load(md5_map)?;

  // Walk the storage dir.
  std::fs::create_dir_all(dest)?;
  crate::util::walk_images(original_path, |hash, path| {
    let Some(hash) = entities.medium_of(hash) else {
      return Ok(());
    };
    let d1 = &hash[0..2];
    let d2 = &hash[2..4];
    let d3 = &hash[4..6];
    let f = &hash[6..];
    let dst = Path::new(dest).join(d1).join(d2).join(d3);
    std::fs::create_dir_all(dst.clone())?;
    std::fs::copy(path, dst.join(f))?;
    Ok(())
  })?;

  Ok(())
}
