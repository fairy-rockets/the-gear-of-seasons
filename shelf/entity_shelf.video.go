package shelf

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"gopkg.in/yaml.v2"
)

func (s *entityShelf) AddVideo(mimeType string, r io.Reader) (*VideoEntity, error) {
	var err error
	var ext string
	switch mimeType {
	case "video/mp4":
		ext = "mp4"
		break
	case "video/x-matroska":
		ext = "mkv"
		break
	default:
		return nil, fmt.Errorf("unsupported video type: %s", mimeType)
	}

	tmpfile, err := ioutil.TempFile("", "fairy-rockets-video")
	if err != nil {
		return nil, err
	}
	defer os.Remove(tmpfile.Name())

	_, err = io.Copy(tmpfile, r)
	if err != nil {
		return nil, err
	}

	_, err = tmpfile.Seek(0, io.SeekStart)
	if err != nil {
		return nil, err
	}

	e := &VideoEntity{}
	e.Width, e.Height, e.Duration, err = decodeVideoMetadata(tmpfile)
	if err != nil {
		return nil, err
	}

	e.MimeType_ = mimeType
	e.Date_ = time.Now()

	_, err = tmpfile.Seek(0, io.SeekStart)
	if err != nil {
		return nil, err
	}

	hash := md5.New()
	_, err = io.Copy(hash, tmpfile)
	if err != nil {
		return nil, err
	}

	e.ID_ = hex.EncodeToString(hash.Sum(nil)[:])
	e.Description_ = ""

	// Save image.
	dirpath := s.dirOf(e)
	yml, err := yaml.Marshal(e)

	if err != nil {
		return nil, fmt.Errorf("failed to serialize yaml: %v", err)
	}

	ymlpath := filepath.Join(dirpath, fmt.Sprintf("%s.video.yml", e.ID_))
	path := filepath.Join(dirpath, fmt.Sprintf("%s.%s", e.ID_, ext))
	e.Path_ = path

	{
		dir := filepath.Dir(path)
		err = os.MkdirAll(dir, 0755)
		if err != nil {
			return nil, err
		}
	}

	_, err = tmpfile.Seek(0, io.SeekStart)
	if err != nil {
		return nil, err
	}
	f, err := os.Create(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	_, err = io.Copy(f, tmpfile)
	if err != nil {
		return nil, fmt.Errorf("failed to save video: %v", err)
	}

	err = ioutil.WriteFile(ymlpath, yml, 0644)
	if err != nil {
		os.Remove(path)
		return nil, fmt.Errorf("failed to save video, metadata: %v", err)
	}
	s.entities[e.ID_] = e
	return e, nil
}

// ----------------------------------------------------------------------------

func decodeVideoMetadata(r io.Reader) (int, int, float64, error) {
	var err error
	c := exec.Command("ffprobe", "-i", "pipe:0", "-print_format", "json", "-show_streams")
	var b bytes.Buffer
	c.Stdin = r
	c.Stdout = &b
	err = c.Run()
	if err != nil {
		return -1, -1, -1, err
	}
	var meta struct {
		Streams []struct {
			CodecType string `json:"codec_type"`
			Width     int    `json:"width"`
			Height    int    `json:"height"`
			Duration  string `json:"duration"`
		} `json:"streams"`
	}
	err = json.Unmarshal(b.Bytes(), &meta)
	if err != nil {
		return -1, -1, -1, err
	}
	for _, str := range meta.Streams {
		if str.CodecType == "video" {
			duration, err := strconv.ParseFloat(str.Duration, 64)
			if err != nil {
				return -1, -1, -1, fmt.Errorf("invalid video duration: %s", str.Duration)
			}
			return str.Width, str.Height, duration, nil
		}
	}
	return -1, -1, -1, fmt.Errorf("video stream not found: %s", b.String())
}
