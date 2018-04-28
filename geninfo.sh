#! /bin/bash

cat > ${GOFILE%.go}.gen.go <<END
package ${GOPACKAGE}

import (
	"strings"
)

func buildAt() string {
	return "$(date "+%Y-%m-%d %H:%M:%S %z")"
}

func gitRev() string {
	rev := "$(git log -1 --date=iso --pretty=format:"[%ad] %h %an : %s")"
	if len(rev) == 0 {
		return "<not available>"
	}
	return strings.TrimSpace(rev)
}

END