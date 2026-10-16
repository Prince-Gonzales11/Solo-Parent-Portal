<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Strict Gate K Safety Guard: Standalone root script retired and deactivated to prevent accidental cloud data loss.
fwrite(STDERR, "\n======================================================================\n");
fwrite(STDERR, "SAFETY NOTICE: cleanup_storage.php is RETIRED and DEACTIVATED.\n");
fwrite(STDERR, "======================================================================\n");
fwrite(STDERR, "Blanket bucket deletion via unauthenticated standalone script is strictly\n");
fwrite(STDERR, "prohibited across all environments to protect permanent citizen documents.\n\n");
fwrite(STDERR, "To safely inspect or clean temporary storage, use the audited Artisan command:\n");
fwrite(STDERR, "  php artisan storage:clean-temp --dry-run\n");
fwrite(STDERR, "======================================================================\n\n");
exit(1);
