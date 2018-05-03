package cache

import (
	"fmt"
	"image"
	"io"
	"os"

	"github.com/FairyRockets/the-gear-of-seasons/seasonshelf/entity"
	"github.com/disintegration/imaging"
	"github.com/nfnt/resize"
	"github.com/rwcarlsen/goexif/exif"
	"github.com/rwcarlsen/goexif/mknote"
)

func decodeExif(e *entity.ImageEntity) (*exif.Exif, error) {
	f, err := os.Open(e.GetPath())
	if err != nil {
		return nil, err
	}
	exif.RegisterParsers(mknote.All...)

	x, err := exif.Decode(f)
	if err != nil {
		if err == io.EOF {
			return nil, nil
		}
		return nil, err
	}
	return x, nil
}

func decodeImage(e *entity.ImageEntity) (image.Image, string, error) {
	f, err := os.Open(e.GetPath())
	if err != nil {
		err = fmt.Errorf("failed to open %s: %v", e.GetPath(), err)
		return nil, "", err
	}
	defer f.Close()
	img, format, err := image.Decode(f)
	return img, format, err
}

func fixOrientation(img image.Image, o string) *image.NRGBA {
	switch o {
	case "1":
		return imaging.Clone(img)
	case "2":
		return imaging.FlipV(img)
	case "3":
		return imaging.Rotate180(img)
	case "4":
		return imaging.Rotate180(imaging.FlipV(img))
	case "5":
		return imaging.Rotate270(imaging.FlipV(img))
	case "6":
		return imaging.Rotate270(img)
	case "7":
		return imaging.Rotate90(imaging.FlipV(img))
	case "8":
		return imaging.Rotate90(img)
	default:
		log().Warnf("unknown orientation %s, expect 1-8", o)
		return imaging.Clone(img)
	}
}

func generateThumbnail(e *entity.ImageEntity, minSize uint) (image.Image, error) {
	var err error
	img, format, err := decodeImage(e)
	if err != nil {
		err = fmt.Errorf("failed to decode %s: %v", e.GetPath(), err)
		return nil, err
	}
	var x *exif.Exif
	if format == "jpeg" {
		x, err = decodeExif(e)
		if err != nil {
			err = fmt.Errorf("failed to decode exif %s: %v", e.GetPath(), err)
			return nil, err
		}
	}
	if e.Width > e.Height {
		img = resize.Resize(uint(e.Width*int(minSize)/e.Height), minSize, img, resize.Bicubic)
	} else {
		img = resize.Resize(minSize, uint(e.Height*int(minSize)/e.Width), img, resize.Bicubic)
	}
	if x != nil {
		orient, _ := x.Get(exif.Orientation)
		return fixOrientation(img, orient.String()), nil
	}
	return img, nil
}
