package fml

import "fmt"

type Uta struct {
	Rens []Ren
}

type Ren interface {
	ToString() string
}

type Text string

func NewText(str string) Text {
	return Text(str)
}

func (str Text) ToString() string {
	return fmt.Sprint("[string ", string(str), "]")
}

type Image map[string]string

func NewImage(dict map[string]string) Ren {
	return Image(dict)
}

func (im Image) ToString() string {
	return fmt.Sprint("[image ", im, "]")
}

type Video map[string]string

func (v Video) ToString() string {
	return fmt.Sprint("[video", v, "]")
}

func NewVideo(dict map[string]string) Ren {
	return Video(dict)
}

type Audio map[string]string

func NewAudio(dict map[string]string) Ren {
	return Audio(dict)
}

func (a Audio) ToString() string {
	return fmt.Sprint("[audio ", a, "]")
}
