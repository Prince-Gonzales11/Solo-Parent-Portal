<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Support\Facades\Route;

class RouteMatrixAuditTest extends TestCase
{
    use \Illuminate\Foundation\Testing\RefreshDatabase;

    /**
     * Audit and verify all 108 registered API routes
     */
    public function test_all_api_routes_matrix_loads_and_rejects_or_responds_without_500(): void
    {
        $routes = Route::getRoutes()->getRoutes();
        $apiRoutes = array_filter($routes, function ($r) {
            return str_starts_with($r->uri(), 'api/');
        });

        $this->assertCount(107, $apiRoutes, "Expected exactly 107 API routes to be registered.");

        $successfulOrGuarded = 0;
        $fiveHundredErrors = [];

        foreach ($apiRoutes as $route) {
            $methods = array_diff($route->methods(), ['HEAD']);
            $method = reset($methods);
            $uri = '/' . ltrim($route->uri(), '/');

            // Replace route parameters with mock UUIDs/IDs for testing
            $testUri = preg_replace('/\{[^}]+\}/', '00000000-0000-0000-0000-000000000000', $uri);

            try {
                $response = $this->json($method, $testUri);
                $status = $response->status();

                // Unauthenticated probe should result in 200 (public), 401, 403, 404, 405, or 422
                // Never unhandled 500
                if ($status === 500) {
                    $fiveHundredErrors[] = "{$method} {$uri} -> 500: " . substr($response->getContent(), 0, 100);
                } else {
                    $successfulOrGuarded++;
                }
            } catch (\Throwable $e) {
                $fiveHundredErrors[] = "{$method} {$uri} -> Exception: " . $e->getMessage();
            }
        }

        $this->assertEmpty($fiveHundredErrors, "Found routes throwing 500 unhandled errors:\n" . implode("\n", $fiveHundredErrors));
        $this->assertEquals(107, $successfulOrGuarded);
    }
}
