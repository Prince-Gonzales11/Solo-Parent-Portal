<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$a = App\Models\Application::where('reference_no', 'SP-202610-5BQ5SM')->first();
if ($a) {
    $a->status = 'completed';
    $a->save();
    echo "Status updated to: " . $a->status . "\n";
} else {
    echo "Application not found\n";
}
