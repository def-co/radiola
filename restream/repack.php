<?php declare(strict_types=1);
namespace PN\Radiola;

exit(main());
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
      //printf("(%d)\n", strlen($chunk));
      //echo $chunk, "\n";
      var_dump(parse($chunk));
    }
    echo "-- done\n";
  }

  return 0;
}

function parse(string $packet): object
{
  $re = new \stdClass();
  foreach (explode("\n", $packet) as $line) {
    $parts = explode("=", $line, 2);
    if (count($parts) !== 2) {
      continue;
    }
    [$key, $value] = $parts;
    $re->{$key} = $value;
  }
  return $re;
}
