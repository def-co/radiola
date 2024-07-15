<?php declare(strict_types=1);
namespace PN\Radiola;

function main(): int
{
  set_error_handler(function (int $severity, string $message, string $file, int $line) {
    throw new \ErrorException(
      message: $message,
      severity: $severity,
      filename: $file,
      line: $line,
    );
  });

  $sock = socket_create(AF_INET6, SOCK_STREAM, SOL_TCP);
  socket_bind($sock, '::1', 9988);
  socket_listen($sock, SOMAXCONN);
  echo "-- listening\n";

  for (;;) {
    $s = socket_accept($sock);
    echo "-- accepted\n";
    $str = socket_export_stream($s);
    while (!feof($str)) {
      $chunk = fread($str, 512 * 1024);
      if (!$chunk) {
        continue;
      }
      printf("(%d) %s\n", strlen($chunk), bin2hex(substr($chunk, 0, min(10, strlen($chunk)))));

    retry:
      if ($chunk === '') {
        echo "warn: empty packet\n";
        continue;
      }

      if (str_contains($chunk, "ID3\x04\x00")) {
        echo "info: packet contains id3\n";
        continue;
      }
      if (ord($chunk[0]) !== 0xFF || ord($chunk[1]) !== 0xFB) {
        echo "warn: packet not mp3 sync\n";
        continue;
      }

      $b2 = ord($chunk[2]);
      $len = packet_size($b2);
      //echo "debug: detected length {$len}\n";
      if ($len === 0) {
        echo "warn: empty length???\n";
        continue;
      }
      if (strlen($chunk) < $len) {
        echo "warn: packet truncated\n";
        continue;
      }
      $chunk = substr($chunk, $len);
      if (!$chunk) {
        continue;
      }
      echo "info: multi packet\n";
      goto retry;
    }
    echo "-- done\n";
  }

  return 0;
}

const BITRATES = [
  0,
  32,
  40,
  48,
  56,
  64,
  80,
  96,
  112,
  128,
  160,
  192,
  224,
  256,
  320,
  0,
];
const SAMPLE_RATE = [
  44100,
  48000,
  32000,
  0,
];

function packet_size(int $b2): int
{
  $bitrate = $b2 >> 4;
  $sampleRate = ($b2 >> 2) & 0b11;
  $padding = ($b2 >> 1) & 0b1;
  //printf(
  //  "debug: b2=%d bitrate=%d/%d sample=%d/%d padding=%d\n",
  //  $b2,
  //  $bitrate, BITRATES[$bitrate],
  //  $sampleRate, SAMPLE_RATE[$sampleRate],
  //  $padding,
  //);
  return intdiv(
    144 * BITRATES[$bitrate] * 1000,
    SAMPLE_RATE[$sampleRate]
  ) + (int) $padding;
}

exit(main());
