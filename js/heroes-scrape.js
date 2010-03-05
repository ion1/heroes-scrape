/*! Copyright © 2009 Johan Kiviniemi
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 */
/* THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

/*global jQuery*/
(function ($) {

var CONSOLE;
if (window.console && typeof window.console.error === 'function') {
  CONSOLE = window.console;
}

function debug (text) {
  if (CONSOLE) { CONSOLE.debug (text); }
}

function HeroesScrapeError (message) {
  this.name = 'HeroesScrapeError';
  this.message = message;
}

HeroesScrapeError.prototype.toString = function () {
  return this.name + ': ' + this.message;
};

function get_wikipedia_page (title, callback) {
  var uri = 'http://en.wikipedia.org/w/api.php?action=parse&page=' +
            title + '&prop=text&format=json&callback=?';

  $.getJSON (uri, function (data) {
    var content = data.parse.text['*'].
                  replace (/<(?:embed|iframe|img|input|object)[^>]*>/gi, '');
    var tree = $('<div/>').html (content)[0];
    callback (tree);
  });
}

var scraped_episodes = false,
    scraped_comics   = false,
    table            = $('<table id="heroes-table"/>'),
    table_ready      = false,
    list             = [];

function add_item (type, id, title, date, other) {
  if (! /^(?:episode|webisode|comic)$/.exec (type) ||
      typeof id      !== 'string' ||
      typeof title   !== 'string' ||
      typeof date    !== 'string' ||
      ! /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.exec (date)) {
    var msg = 'add_item: Invalid parameters (type: ' + type +
              ', id: ' + id + ', title: ' + title + ', date: ' + date;
    throw new HeroesScrapeError (msg);
  }

  var item = {
    type:  type,
    id:    id,
    title: title,
    date:  date
  };
  $.extend (item, other);
  list.push (item);
}

var sort_type_map = {
  'episode':  0,
  'webisode': 1,
  'comic':    2
};

function sort_list () {
  list.sort (function (a, b) {
    if (a.date !== b.date) {
      return (a.date < b.date) ? -1 : 1;

    } else if (a.type !== b.type) {
      return (sort_type_map[a.type] < sort_type_map[b.type]) ? -1 : 1;

    } else if (a.id !== b.id) {
      return (a.id < b.id) ? -1 : 1;

    } else {
      return 0;
    }
  });

  list.reverse ();
}

function now () {
  var date = (function (offset) {
    var date = new Date (),
        utc  = date.getTime () + 60*1000 * date.getTimezoneOffset ();
    return new Date (utc + 60*60*1000 * offset);
  }) (-5);

  return pad (date.getFullYear (), 4) +
         '-' + pad (date.getMonth () + 1, 2) +
         '-' + pad (date.getDate (), 2);
}

function generate_table () {
  if (! scraped_episodes || ! scraped_comics) {
    return;
  }

  sort_list ();

  var today = now ();

  var thead = $('<thead/>').appendTo (table),
      tbody = $('<tbody/>').appendTo (table);

  $('<tr/>').
    appendTo (thead).
    append ('<th class="date">Date</th>').
    append ('<th class="type">Type</th>').
    append ('<th class="id">ID</th>').
    append ('<th class="title">Title</th>').
    append ('<th class="misc"> </th>');

  // Generate the table in chunks to avoid hogging the browser for seconds.

  var interval = setInterval (function () {
    for (var i = 0; i < 20; i++) {
      var item = list.shift ();
      if (typeof item === 'undefined') {
        table_ready = true;
        if ($.isReady) { $('#heroes-table-loading').remove (); }
        clearInterval (interval);
        return;
      }

      var tr = $('<tr/>').appendTo (tbody);

      if (item.date === today) {
        tr.addClass ('today');
      } else if (item.date > today) {
        tr.addClass ('upcoming');
      }

      tr.addClass (item.type);

      var td_date  = $('<td/>').addClass ('date').appendTo (tr),
          td_type  = $('<td/>').addClass ('type').appendTo (tr),
          td_id    = $('<td/>').addClass ('id').appendTo (tr),
          td_title = $('<td/>').addClass ('title').appendTo (tr),
          td_misc  = $('<td/>').addClass ('misc').appendTo (tr);

      td_date.text (item.date);

      $('<img/>').
        attr ({
          'src':   'img/' + item.type + '.png',
          'alt':   item.type,
          'title': item.type,
          'class': 'icon'
        }).
        appendTo (td_type);

      td_id.text (item.id);

      if (item.uri) {
        $('<a/>').
          text (item.title).
          attr ('href', item.uri).
          appendTo (td_title);

      } else {
        td_title.text (item.title);
      }

      if (item.wp_uri) {
        $('<a/>').
          attr ('href', item.wp_uri).
          append (
            $('<img/>').
              attr ({
                'src':   'img/wikipedia.png',
                'alt':   'Wikipedia',
                'title': "\u201c" + item.title + "\u201d in Wikipedia",
                'class': 'icon'
              })
          ).
          appendTo (td_misc);
      }
    }
  }, 1);
}

function scrape_episodes (tree) {
  try {
    $('h2:contains("Main series")', tree).
    nextUntil ('h2').
    filter ('.wikitable').
    each (scrape_episodes_season_table);
  } catch (e) {
    if (CONSOLE) { CONSOLE.error (e); }
  }

  try {
    $('h2:contains("Web-based spin-offs")', tree).
    nextUntil ('h2').
    filter ('.wikitable').
    each (scrape_webisodes_table);
  } catch (e) {
    if (CONSOLE) { CONSOLE.error (e); }
  }

  scraped_episodes = true;
  generate_table ();
}

function scrape_episodes_season_table () {
  var heading = $(this).prevAll ('h3').first ().find ('.mw-headline').text ();
  var heading_match = heading.match (/^Season ([0-9]+)/);
  if (! heading_match) {
    return;
  }

  var season = + heading_match[1];

  var ep_col = $('tr:first th:contains("#")', this).index ();

  // The first episode of a season.
  var first_ep = null;

  $('tr.vevent', this).each (function () {
    var ep = $('td', this).eq (ep_col).text ();
    var ep_match = ep.match (/^([0-9]+)/);
    if (! ep_match) {
      return;
    }
    ep = + ep_match[1];

    if (first_ep === null) {
      first_ep = ep;
    }

    var ep_real = 1 + ep - first_ep,
        id      = '' + season + 'x' + pad (ep_real, 2),
        title   = cleanup_title ($('.summary', this).text ()),
        wp_uri  = $('.summary a[href]', this).attr ('href'),
        date    = $('.dtstart', this).text ();

    if (title === '' || date === '') {
      return;
    }

    if (wp_uri) {
      wp_uri = 'http://en.wikipedia.org' + wp_uri;
    }

    try {
      add_item ('episode', id, title, date, { wp_uri: wp_uri });
    } catch (e) {
      if (CONSOLE) { CONSOLE.error (e); }
    }
  });
}

function scrape_webisodes_table () {
  var heading = $(this).prevAll ('h3').first ().find ('.mw-headline').text ();

  var id_prefix_match = heading.match (/\b(\w)/g);
  if (! id_prefix_match) {
    return;
  }
  var id_prefix = id_prefix_match.join ('').toLowerCase ();

  var ep_col = $('tr:first th:contains("#")', this).index ();

  $('tr.vevent', this).each (function () {
    var ep = $('td', this).eq (ep_col).text ();
    var ep_match = /^([0-9]+)/.exec (ep);
    if (! ep_match) {
      return;
    }
    ep = + ep_match[1];

    var id    = id_prefix + pad (ep, 2),
        title = heading + ' \u2013 ' + cleanup_title ($('.summary', this).text ()),
        date  = $('.dtstart', this).text ();

    if (title === '' || date === '') {
      return;
    }

    try {
      add_item ('webisode', id, title, date);
    } catch (e) {
      if (CONSOLE) { CONSOLE.error (e); }
    }
  });
}

function scrape_comics (tree) {
  var bonus = 0;

  $(tree).find ('.wikitable').each (function () {
      var issue_col = $('tr:first th:contains("Issue")', this).index (),
          title_col = $('tr:first th:contains("Title")', this).index (),
          date_col  = $('tr:first th:contains("Release date")', this).index ();

      $('tr', this).each (function () {
        var issue = $('td', this).eq (issue_col).text ();
        var issue_match = issue.match (/^([0-9]+)/);
        var id;
        if (issue_match) {
          id = issue_match[1];

        } else if (issue.match (/^(?:Bonus|Interactive Novel)/)) {
          bonus++;
          id = 'b' + bonus;

        } else {
          return;
        }

        var title_a = $('td', this).eq (title_col).find ('a[href]:first'),
            title   = cleanup_title (title_a.text ()),
            uri     = title_a.attr ('href'),
            date    = $('td', this).eq (date_col).text ();

        if (title === '' || date === '') {
          return;
        }

        try {
          add_item ('comic', id, title, date, { uri: uri });
        } catch (e) {
          if (CONSOLE) { CONSOLE.error (e); }
        }
      });
  });

  scraped_comics = true;
  generate_table ();
}

function cleanup_title (str) {
  return str.replace (/^"(.+)"(?:\[\w+\])?$/, '$1');
}

function pad (num, len) {
  var res = '' + num;

  while (res.length < len) {
    res = '0' + res;
  }

  return res;
}

get_wikipedia_page ('List_of_Heroes_episodes',       scrape_episodes);
get_wikipedia_page ('List_of_Heroes_graphic_novels', scrape_comics);

$(function () {
  $('#heroes-table-container').
    empty ().
    append (table).
    append ('<div id="heroes-table-loading">Loading...</div>');

  if (table_ready) { $('#heroes-table-loading').remove (); }
});

}) (jQuery);

// vim:set et sw=2 sts=2:
