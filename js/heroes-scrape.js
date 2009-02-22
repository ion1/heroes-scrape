/* Copyright © 2009 Johan Kiviniemi
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

/*global jQuery*/
(function ($) {

function debug (text) {
  $('<div/>').prependTo ('#content').text (text);
}

function ce (name) {
  return $(document.createElement (name));
}

function HeroesScrapeError (message) {
  this.name = 'HeroesScrapeError';
  this.message = message;
}

HeroesScrapeError.prototype.toString = function () {
  return this.name + ': ' + this.message;
};

function pad (num, len) {
  var res = '' + num;

  while (res.length < len) {
    res = '0' + res;
  }

  return res;
}

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
    throw new HeroesScrapeError ('add_item: Invalid parameters');
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

      var tr = ce ('tr').appendTo (tbody);

      if (item.date === today) {
        tr.addClass ('today');
      } else if (item.date > today) {
        tr.addClass ('upcoming');
      }

      tr.addClass (item.type);

      var td_date  = ce ('td').addClass ('date').appendTo (tr),
          td_type  = ce ('td').addClass ('type').appendTo (tr),
          td_id    = ce ('td').addClass ('id').appendTo (tr),
          td_title = ce ('td').addClass ('title').appendTo (tr),
          td_misc  = ce ('td').addClass ('misc').appendTo (tr);

      td_date.text (item.date);

      ce ('img').
        attr ({
          'src':   'img/' + item.type + '.png',
          'alt':   item.type,
          'title': item.type,
          'class': 'icon'
        }).
        appendTo (td_type);

      td_id.text (item.id);

      if (item.uri) {
        ce ('a').
          text (item.title).
          attr ('href', item.uri).
          appendTo (td_title);

      } else {
        td_title.text (item.title);
      }

      if (item.wp_uri) {
        ce ('a').
          attr ('href', item.wp_uri).
          append (
            ce ('img').
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

var month_map = {
  january:    1,
  february:   2,
  march:      3,
  april:      4,
  may:        5,
  june:       6,
  july:       7,
  august:     8,
  september:  9,
  october:   10,
  november:  11,
  december:  12
};

function parse_date (string) {
  var m = /^(\S+) ([0-9]+), ([0-9]+)/.exec (string);

  if (! m || ! month_map[m[1].toLowerCase ()]) {
    throw new HeroesScrapeError ('parse_date: Invalid parameters');
  }

  var year  = + m[3],
      month = month_map[m[1].toLowerCase ()],
      day   = + m[2];

  return pad (year, 4) + '-' + pad (month, 2) + '-' + pad (day, 2);
}

var webisode_id_map = {
  'Going Postal':    'gp',
  'Heroes: Destiny': 'hd',
  'The Recruit':     'tr',
  'Hard Knox':       'hk'
};

var webisode_re = /^(?:Going Postal|Heroes: Destiny|The Recruit|Hard Knox)$/;

function scrape_episodes (tree) {
  $(tree).find ('h3').each (function () {
    var text = $(this).find ('.mw-headline').text ();

    var type,
        id_prefix,
        title_prefix,
        date_col;

    var match = /^Season ([0-9]+)/.exec (text);
    if (match) {
      type         = 'episode';
      id_prefix    = match[1] + 'x';
      title_prefix = '';
      date_col     = 5;

    } else if (webisode_id_map[text]) {
      type         = 'webisode';
      id_prefix    = webisode_id_map[text];
      title_prefix = text + ' \u2013 ';
      date_col     = 4;

    } else {
      return;
    }

    // The first episode of a season.
    var first_ep = null;

    $(this).next ('table.wikitable').find ('tr').each (function () {
      var ep = $(this).find ('td:eq(0)').text ();

      if (! /^[0-9]+$/.exec (ep)) {
        return;
      }

      ep = + ep;
      if (first_ep === null) {
        first_ep = ep;
      }

      try {
        var ep_real = 1 + ep - first_ep,
            id      = id_prefix + pad (ep_real, 2),
            title   = title_prefix + $(this).find ('td:eq(1) b').text (),
            wp_uri  = $(this).find ('td:eq(1) b a').attr ('href'),
            date    = parse_date ($(this).find ('td:eq('+date_col+')').text ());

        if (wp_uri) {
          wp_uri = 'http://en.wikipedia.org' + wp_uri;
        }

        add_item (type, id, title, date, { wp_uri: wp_uri });

      } catch (e) {
        if (window.console && console.error) { console.error (e); }
      }
    });
  });

  scraped_episodes = true;
  generate_table ();
}

function scrape_comics (tree) {
  var bonus = 0;

  $(tree).find ('table.wikitable tr').each (function () {
    var id = $(this).find ('td:eq(0)').text ();

    if (/^[0-9]+$/.exec (id)) {
      // Proceed.

    } else if (/^(?:Bonus|Interactive Novel)/.exec (id)) {
      bonus++;
      id = 'b' + bonus;

    } else {
      return;
    }

    var title = $(this).find ('td:eq(1) a:first').text (),
        uri   = $(this).find ('td:eq(1) a:first').attr ('href'),
        date  = $(this).find ('td:eq(2)').text ();

    try {
      add_item ('comic', id, title, date, { uri: uri });

    } catch (e) {
      if (console && console.error) { console.error (e); }
    }
  });

  scraped_comics = true;
  generate_table ();
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
