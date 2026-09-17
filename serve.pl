#!/usr/bin/env perl
use strict;
use warnings;
use HTTP::Daemon;
use HTTP::Status;

my $port = $ARGV[0] || 8765;
my $root = "$ENV{PWD}";

my %types = (
  html => 'text/html',
  css  => 'text/css',
  js   => 'application/javascript',
  png  => 'image/png',
  json => 'application/json',
);

my $d = HTTP::Daemon->new(LocalPort => $port, Reuse => 1) or die "Could not start server: $!";
print "Serving $root at ", $d->url, "\n";

while (my $c = $d->accept) {
  while (my $r = $c->get_request) {
    if ($r->method eq 'GET') {
      my $path = $r->uri->path;
      $path = '/index.html' if $path eq '/';
      my $file = "$root$path";
      if (-e $file && -f $file) {
        open(my $fh, '<:raw', $file) or do { $c->send_error(500); next; };
        local $/;
        my $content = <$fh>;
        close($fh);
        my ($ext) = $file =~ /\.([^.]+)$/;
        my $type = $types{lc($ext // '')} || 'application/octet-stream';
        $c->send_response(HTTP::Response->new(200, 'OK', ['Content-Type' => $type], $content));
      } else {
        $c->send_error(RC_NOT_FOUND);
      }
    } else {
      $c->send_error(RC_METHOD_NOT_ALLOWED);
    }
  }
  $c->close;
  undef($c);
}
