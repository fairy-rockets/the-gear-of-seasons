import Repo from "../repo/Repo.js";
import Shelf from "../shelf/Shelf.js";

async function main() {
  const repo = new Repo();
  const shelf = new Shelf(repo);
}

main()
  .then(() => {})
  .catch((err) => {
    console.error(err);
    throw err;
  });
