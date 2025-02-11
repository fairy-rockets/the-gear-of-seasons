use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use tracing::info;

pub fn run(m: &clap::ArgMatches) -> anyhow::Result<()> {
  let output = m.get_one::<String>("OUTPUT").expect("[BUG] No OUTPUT");
  let original_path = m.get_one::<String>("ORIGINAL").expect("[BUG] No ORIGINAL PATH");
  info!("output: {}", output);
  info!("original path: {}", original_path);

  let hasher = crate::util::make_hasher();
  let mut path_to_ahash = HashMap::<PathBuf, String>::new();
  crate::util::walk_images(original_path, |_, path| {
    info!("Processing: {:?}", &path);
    let img = image::open(&path)?;
    path_to_ahash.insert(path.to_path_buf(), hasher.hash(&img).to_string());
    Ok(())
  })?;

  let mut f = std::fs::File::create(output)?;
  for (k, v) in path_to_ahash {
    f.write(k.into_os_string().as_encoded_bytes())?;
    f.write(",".as_bytes())?;
    f.write(v.as_bytes())?;
    f.write("\n".as_bytes())?;
  }

  Ok(())
}
