package fml

import "fmt"

type Uta struct {
	Rens []Ren
}

type Ren interface {
	ToString() string
}

// ----------------------------------------------------------------------------

type Text string

func NewText(str string) Text {
	return Text(str)
}

func (str Text) ToString() string {
	return string(str)
}

// ----------------------------------------------------------------------------

type Image struct {
	EntityID string
	LinkURL  string
}

func NewImage(dict map[string]string) Ren {
	return &Image{
		EntityID: dict["entity"],
		LinkURL:  dict["url"],
	}
}

func (im *Image) ToString() string {
	return fmt.Sprintf(`[image entity="%s" url="%s"]`, im.EntityID, im.LinkURL)
}

// ----------------------------------------------------------------------------

type Video struct {
	EntityID string
}

func NewVideo(dict map[string]string) Ren {
	return &Video{
		EntityID: dict["entity"],
	}
}

func (v *Video) ToString() string {
	return fmt.Sprintf(`[video entity="%s"]`, v.EntityID)
}

// ----------------------------------------------------------------------------

type Audio struct {
	EntityID string
}

func NewAudio(dict map[string]string) Ren {
	return &Audio{
		EntityID: dict["entity"],
	}
}

func (a *Audio) ToString() string {
	return fmt.Sprintf(`[audio entity="%s"]`, a.EntityID)
}

// ----------------------------------------------------------------------------

type Link struct {
	EntityID string
	Text     string
}

func NewLink(dict map[string]string) Ren {
	return &Link{
		EntityID: dict["entity"],
		Text:     dict["text"],
	}
}

func (link *Link) ToString() string {
	return fmt.Sprintf(`[link entity="%s" text="%s"]`, link.EntityID, link.Text)
}

// ----------------------------------------------------------------------------

type Markdown struct {
	URL string
}

func NewMarkdown(dict map[string]string) Ren {
	return &Markdown{
		URL: dict["url"],
	}
}

func (md *Markdown) ToString() string {
	return fmt.Sprintf(`[markdown url="%s"]`, md.URL)
}
