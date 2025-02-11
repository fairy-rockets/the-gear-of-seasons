use std::path::Path;
use tracing::info;

pub fn run(m: &clap::ArgMatches) -> anyhow::Result<()> {
  let input = m.get_one::<String>("INPUT").expect("[BUG] No INPUT");
  let output = m.get_one::<String>("OUTPUT").expect("[BUG] No OUTPUT");
  let storage = m.get_one::<String>("STORAGE").expect("[BUG] No PATH");
  info!("input: {}", input);
  info!("output: {}", output);
  info!("storage: {}", storage);

  // Read the input hashes
  let mut entities = crate::util::Entities::new();
  info!("[{}] reading input file.", input);
  let duration = {
    let beg = std::time::Instant::now();
    entities.load(input)?;
    let end = std::time::Instant::now();
    end.duration_since(beg)
  };
  info!("[{}] {} images, took {} [ms]", input, entities.len(), duration.as_millis());

  // Walk the storage dir.
  std::fs::create_dir_all(output)?;
  crate::util::walk_images(storage, |hash, path| {
    let Some(hash) = entities.medium_of(hash) else {
      return Ok(());
    };
    let d1 = &hash[0..2];
    let d2 = &hash[2..4];
    let d3 = &hash[4..6];
    let f = &hash[6..];
    let dst = Path::new(output).join(d1).join(d2).join(d3);
    std::fs::create_dir_all(dst.clone())?;
    std::fs::copy(path, dst.join(f))?;
    Ok(())
  })?;

  Ok(())
}
