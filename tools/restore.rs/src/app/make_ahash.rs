use std::fs::OpenOptions;
use std::io::Write;
use tracing::{info, warn};

pub fn run(m: &clap::ArgMatches) -> anyhow::Result<()> {
  let output = m.get_one::<String>("OUTPUT").expect("[BUG] No OUTPUT");
  let original_path = m.get_one::<String>("ORIGINAL").expect("[BUG] No ORIGINAL");
  info!("output: {}", output);
  info!("original path: {}", original_path);

  let hasher = crate::util::make_hasher();
  let mut originals = crate::util::Originals::new();
  match originals.load(output) {
    Ok(_) => info!("Restored"),
    Err(err) => {
      warn!("{} may be broken. Removed. err = {:?}", output, err);
      std::fs::remove_file(output)?;
    },
  }

  let mut f = OpenOptions::new().write(true).append(true).open(output)?;
  crate::util::walk_images(original_path, |_, path| {
    if let Some(_) = originals.hash_of(&path) {
      info!("Skip: {:?}", &path);
      return Ok(());
    }
    let Ok(img) = image::open(&path) else {
      info!("Not an image: {:?}", &path);
      return Ok(());
    };
    info!("Processing: {:?}", &path);
    {
      use std::io::BufWriter;
      let mut buff = Vec::<u8>::new();
      {
        let mut f = BufWriter::new(&mut buff);
        f.write(path.into_os_string().as_encoded_bytes())?;
        f.write(",".as_bytes())?;
        f.write(hasher.hash(&img).to_string().as_bytes())?;
        f.write("\n".as_bytes())?;
        f.flush()?;
      }
      f.write_all(&buff)?;
      f.flush()?;
    }
    Ok(())
  })?;

  Ok(())
}
