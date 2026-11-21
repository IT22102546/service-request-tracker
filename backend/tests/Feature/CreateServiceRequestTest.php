<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreateServiceRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_request_and_server_controls_owner_status_and_version(): void
    {
        $me = User::factory()->create();
        $someoneElse = User::factory()->create();

        $response = $this->actingAs($me)->postJson('/api/requests', [
            'title' => 'Printer not working',
            'description' => 'Office printer stopped responding.',
            'priority' => 'HIGH',
            // Attempts to spoof server-controlled fields are ignored.
            'created_by' => $someoneElse->id,
            'status' => 'RESOLVED',
            'version' => 99,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.title', 'Printer not working')
            ->assertJsonPath('data.priority', 'HIGH')
            ->assertJsonPath('data.status', 'OPEN')
            ->assertJsonPath('data.version', 1)
            ->assertJsonPath('data.created_by', $me->id);

        $this->assertDatabaseHas('service_requests', [
            'id' => $response->json('data.id'),
            'created_by' => $me->id,
            'status' => 'OPEN',
            'version' => 1,
        ]);
    }

    public function test_invalid_input_returns_422_with_field_errors(): void
    {
        $this->actingAs(User::factory()->create());

        $this->postJson('/api/requests', [
            'title' => 'ab',                      // < 3 chars
            'description' => 'too short',         // < 10 chars
            'priority' => 'URGENT',               // not an allowed value
        ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_FAILED')
            ->assertJsonValidationErrors(['title', 'description', 'priority']);

        $this->postJson('/api/requests', [
            'title' => str_repeat('a', 101),
            'description' => str_repeat('b', 501),
            'priority' => 'LOW',
        ])->assertStatus(422)->assertJsonValidationErrors(['title', 'description']);

        $this->postJson('/api/requests', [])->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'description', 'priority']);

        $this->assertDatabaseCount('service_requests', 0);
    }
}
