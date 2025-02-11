use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::{Seek, SeekFrom, Write};
use std::path::PathBuf;
use tracing::info;

pub fn run(m: &clap::ArgMatches) -> anyhow::Result<()> {
  let output = m.get_one::<String>("OUTPUT").expect("[BUG] No OUTPUT");
  let original_path = m.get_one::<String>("ORIGINAL").expect("[BUG] No ORIGINAL");
  info!("output: {}", output);
  info!("original path: {}", original_path);

  let hasher = crate::util::make_hasher();
  let mut originals = crate::util::Originals::new();
  match originals.load(output) {
    Ok(_) => info!("Restored"),
    Err(_) => std::fs::remove_file(output)?,
  }
  let mut f = OpenOptions::new().write(true).append(true).open(output)?;
  crate::util::walk_images(original_path, |_, path| {
    if let Some(_) = originals.hash_of(&path) {
      return Ok(());
    }
    info!("Processing: {:?}", &path);
    let img = image::open(&path)?;
    {
      f.write(path.into_os_string().as_encoded_bytes())?;
      f.write(",".as_bytes())?;
      f.write(hasher.hash(&img).to_string().as_bytes())?;
      f.write("\n".as_bytes())?;
    }
    Ok(())
  })?;

  Ok(())
}
