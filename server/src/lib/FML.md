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
