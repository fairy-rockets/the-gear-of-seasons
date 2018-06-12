package cache

import (
	"fmt"
	"image"
	"os"

	"github.com/FairyRockets/the-gear-of-seasons/shelf"
	"github.com/FairyRockets/the-gear-of-seasons/util"
	"github.com/disintegration/imaging"
	"github.com/nfnt/resize"
	"github.com/rwcarlsen/goexif/exif"
)

func decodeImage(e *shelf.ImageEntity) (image.Image, string, error) {
	f, err := os.Open(e.GetPath())
	if err != nil {
		err = fmt.Errorf("failed to open %s: %v", e.GetPath(), err)
		return nil, "", err
	}
	defer f.Close()
	img, format, err := image.Decode(f)
	return img, format, err
}

func fixOrientation(img image.Image, x *exif.Exif) image.Image {
	tag, err := x.Get(exif.Orientation)
	if err != nil {
		if !exif.IsTagNotPresentError(err) {
			log().Warnf("Failed to read orientation tag: %v", err)
		}
		return img
	}
	o, err := tag.Int(0)
	if err != nil {
		log().Warnf("Failed to read orientation tag: %v", err)
		return img
	}

	switch o {
	case 1:
		return imaging.Clone(img)
	case 2:
		return imaging.FlipV(img)
	case 3:
		return imaging.Rotate180(img)
	case 4:
		return imaging.Rotate180(imaging.FlipV(img))
	case 5:
		return imaging.Rotate270(imaging.FlipV(img))
	case 6:
		return imaging.Rotate270(img)
	case 7:
		return imaging.Rotate90(imaging.FlipV(img))
	case 8:
		return imaging.Rotate90(img)
	default:
		log().Warnf("unknown orientation %d, expect 1-8", o)
		return img
	}
}

func calcImageSizeWithMinLength(width, height, minLength uint) (uint, uint) {
	if width > height {
		return width * minLength / height, minLength
	} else {
		return minLength, height * minLength / width
	}
}

func generateThumbnail(e *shelf.ImageEntity, minLength uint) (image.Image, error) {
	var err error
	img, format, err := decodeImage(e)
	if err != nil {
		err = fmt.Errorf("failed to decode %s: %v", e.GetPath(), err)
		return nil, err
	}
	var x *exif.Exif
	if format == "jpeg" {
		x, err = util.DecodeExifFromFile(e.Path)
		if err != nil {
			err = fmt.Errorf("failed to decode exif %s: %v", e.GetPath(), err)
			return nil, err
		}
	}
	width := img.Bounds().Size().X
	height := img.Bounds().Size().Y
	sw, sh := calcImageSizeWithMinLength(uint(width), uint(height), minLength)
	img = resize.Resize(sw, sh, img, resize.Bicubic)
	if x != nil {
		return fixOrientation(img, x), nil
	}
	return img, nil
}
