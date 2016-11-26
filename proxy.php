<?php

function perform_request($uri) {
    $ch = curl_init($uri);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true
    ]);
    $data = curl_exec($ch);
    if (curl_errno($ch) !== 0) {
        curl_close($ch);
        header('Content-Type: text/plain; charset=utf-8', true, 400);
        die('Something went awry.');
    }
    curl_close($ch);
    return $data;
}

if (preg_match('/\\.json$/', $_GET['u']) !== 1) {
    header('Content-Type: text/plain; charset=utf-8', true, 404);
    die('404 Not Found');
}

header('Content-Type: application/json; charset=utf-8');

switch ($_GET['u']) {
    case '/discover_pieci.json':
        die(perform_request('http://fm.pieci.lv/shared/cache/current_all.json'));

    case '/discover_swh_rock.json':
        $d = perform_request('http://195.13.237.142:8080/rock_online.txt');
        die(json_encode($d));

    case '/discover_swh/swh.json':
        die(perform_request('http://195.13.237.142:8080/swh_online.json'));

    case '/discover_swh/gold.json':
        die(perform_request('http://195.13.237.142:8080/gold_online.json'));

    case '/discover_ehr.json':
        die(perform_request('http://www.ehrmedijugrupa.lv/api/channel/now_playing?stream_id=1'));

    default:
        die('[]');
}
