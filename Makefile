# Copyright © 2009 Johan Kiviniemi
#
# Permission to use, copy, modify, and/or distribute this software for any
# purpose with or without fee is hereby granted, provided that the above
# copyright notice and this permission notice appear in all copies.
#
# THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
# WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
# MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
# ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
# WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
# ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
# OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

sources_js  := js/heroes-scrape.js
sources_css := css/style.css

targets_js  := $(sources_js:%.js=%.min.js)
targets_css := $(sources_css:%.css=%.min.css)

ifndef YUICOMPRESSOR
$(error YUICOMPRESSOR not defined)
endif

ifndef CLOSURECOMPILER
$(error CLOSURECOMPILER not defined)
endif

compress_css := java -jar "$(YUICOMPRESSOR)"
compress_js  := java -jar "$(CLOSURECOMPILER)" \
                     --warning_level VERBOSE --summary_detail_level 3

all : $(targets_js) $(targets_css)

%.min.js : %.js
	$(compress_js) --js_output_file "$@" --js "$<"

%.min.css : %.css
	$(compress_css) -o "$@" "$<"

.PHONY : clean
clean ::
	$(RM) $(targets_js) $(targets_css)

