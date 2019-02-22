package storage

import (
	"fmt"
	"io"
	"io/ioutil"
	"math/rand"
	"os"
	"path/filepath"
	"time"
)

const trashPrefix = ".trash"
const tmpPrefix = ".tmp"

type Storage struct {
	// Path of Storage
	dirPath string
}

func NewStorage(dirPath string) (*Storage, error) {
	var err error
	dirPath, err = filepath.Abs(dirPath)
	if err != nil {
		return nil, err
	}
	dirPath = filepath.Clean(dirPath)
	err = os.MkdirAll(dirPath, 0755)
	if err != nil {
		return nil, err
	}
	s := &Storage{
		dirPath: dirPath,
	}
	return s, nil
}

func (s *Storage) path(path string) string {
	return filepath.Join(s.dirPath, path)
}

func (s *Storage) OpenTempFile(ext string) (string, *os.File, error) {
	date := time.Now().Format(`20060102-150405`)
	randNum := rand.Intn(10000)
	path := fmt.Sprintf(`%s_%04d.%s`, date, randNum, ext)
	f, err := os.OpenFile(filepath.Join(s.dirPath, tmpPrefix, path), os.O_RDWR|os.O_CREATE|os.O_EXCL, 0600)
	return filepath.Join(tmpPrefix, path), f, err
}

func (s *Storage) UpdateFileWithTempFile(path string, tmpFile *os.File) error {
	var err error
	tmpPath := tmpFile.Name()
	if filepath.Clean(filepath.Dir(tmpPath)) != s.path(tmpPrefix) {
		return fmt.Errorf(`given file %s is not a temp file`, tmpPath)
	}
	err = tmpFile.Sync()
	if err != nil {
		return err
	}
	err = os.Rename(tmpPath, s.path(path))
	if err != nil {
		return err
	}
	return tmpFile.Close()
}

func (s *Storage) UpdateFileWithReader(path string, reader io.Reader) error {
	var err error
	tmpPath := path + ".tmp"
	f, err := s.CreateFile(tmpPath)
	if err != nil {
		return err
	}
	_, err = io.Copy(f, reader)
	if err != nil {
		return err
	}
	err = f.Close()
	if err != nil {
		return err
	}
	return os.Rename(tmpPath, s.path(path))
}

func (s *Storage) UpdateFileWithBytes(path string, content []byte) error {
	var err error
	tmpPath := s.path(path + ".tmp")
	f, err := s.CreateFile(tmpPath)
	if err != nil {
		return err
	}
	_, err = f.Write(content)
	if err != nil {
		return err
	}
	err = f.Close()
	if err != nil {
		return err
	}
	return os.Rename(tmpPath, s.path(path))
}

func (s *Storage) RenameFileWithBytes(old, new string, content []byte) error {
	var err error
	f, err := s.CreateFile(s.path(new))
	if err != nil {
		return err
	}
	_, err = f.Write(content)
	if err != nil {
		return err
	}
	err = f.Close()
	if err != nil {
		return err
	}
	return os.Remove(s.path(old))
}

func (s *Storage) WriteFile(path string, content []byte) error {
	var err error
	name, f, err := s.OpenTempFile(filepath.Ext(path))
	if err != nil {
		return err
	}
	_, err = f.Write(content)
	if err != nil {
		return err
	}
	err = f.Close()
	if err != nil {
		return err
	}
	return os.Rename(name, s.path(path))
}

func (s *Storage) ReadFile(path string) ([]byte, error) {
	var err error
	f, err := s.OpenFile(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return ioutil.ReadAll(f)
}

func (s *Storage) Exists(path string) bool {
	realPath := s.path(path)
	stat, err := os.Stat(realPath)
	return err == nil && stat.Mode().IsRegular()
}

func (s *Storage) OpenFile(path string) (*os.File, error) {
	return os.OpenFile(s.path(path), os.O_RDONLY, 0)
}

func (s *Storage) CreateFile(path string) (*os.File, error) {
	return os.OpenFile(s.path(path), os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0666)
}

func (s *Storage) WalkFiles(path string, fn func(path string, info os.FileInfo, err error) error) error {
	return filepath.Walk(s.path(path), func(path string, info os.FileInfo, err error) error {
		if !info.Mode().IsRegular() {
			return nil
		}
		rel, err := filepath.Rel(s.dirPath, path)
		if err != nil {
			return err
		}
		return fn(rel, info, err)
	})
}

func (s *Storage) Mkdir(path string) error {
	return os.MkdirAll(s.path(path), 0755)
}

func (s *Storage) Remove(path string) error {
	return os.RemoveAll(s.path(path))
}

func (s *Storage) Rename(old, new string) error {
	return os.Rename(s.path(old), s.path(new))
}
