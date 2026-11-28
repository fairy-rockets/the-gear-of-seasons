# FML

## Media captions

Add the optional `caption` attribute to an image or a video in the moment body:

```text
[image entity="IMAGE_ID" caption="The first snow"]
[video entity="VIDEO_ID" caption="Snow falling"]
```

Omote and the ura preview show the caption as plain text below the media.
The attribute works for uploaded and externally hosted videos. An image's
optional `link` applies to the image itself. Empty and whitespace-only captions
are omitted. FML uses ASCII double quotes to delimit attribute values, so a
caption cannot contain a literal ASCII double quote.

## Galleries

Group images and videos in a responsive grid:

```text
[gallery columns="3" caption="The first snow"]
[image entity="IMAGE_ID" caption="Snow on the trees"]
[video entity="VIDEO_ID"]
[/gallery]
```

Use one or more image or video blocks separated by whitespace. The closing
`[/gallery]` is required. Use an optional `columns` value from 1 to 8 to set
the maximum number of columns (default 2). The grid uses fewer columns when
space is limited. The optional gallery caption appears below the grid and
uses the same rules as individual captions.
