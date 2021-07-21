import Shelf from "../../shelf/Shelf";

export default class UploadController {
  private readonly shelf: Shelf;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  static async create(shelf: Shelf): Promise<UploadController> {
    return new UploadController(shelf);
  }
}