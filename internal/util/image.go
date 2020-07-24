package util

import (
	"io"

	"os"

	"github.com/rwcarlsen/goexif/exif"
	"github.com/rwcarlsen/goexif/mknote"
)

func DecodeExif(reader io.Reader) (*exif.Exif, error) {
	exif.RegisterParsers(mknote.All...)

	x, err := exif.Decode(reader)
	if err != nil {
		if err == io.EOF {
			return nil, nil
		}
		return nil, err
	}
	return x, nil
}
func DecodeExifFromFile(path string) (*exif.Exif, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return DecodeExif(f)
}
