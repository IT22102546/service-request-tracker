<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    /** Requests from the SPA origin are treated as stateful by Sanctum. */
    private array $spa = ['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000/'];

    public function test_user_can_sign_in_and_fetch_current_user(): void
    {
        $user = User::factory()->create(['email' => 'alice@example.com', 'password' => 'secret-pass']);

        $this->withHeaders($this->spa)
            ->postJson('/api/auth/login', ['email' => 'alice@example.com', 'password' => 'secret-pass'])
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.email', 'alice@example.com')
            ->assertJsonMissingPath('data.password');

        $this->assertAuthenticatedAs($user, 'web');

        $this->withHeaders($this->spa)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);
    }

    public function test_sign_in_with_wrong_password_is_rejected(): void
    {
        User::factory()->create(['email' => 'alice@example.com', 'password' => 'secret-pass']);

        $this->withHeaders($this->spa)
            ->postJson('/api/auth/login', ['email' => 'alice@example.com', 'password' => 'wrong'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_FAILED')
            ->assertJsonValidationErrors('email');

        $this->assertGuest('web');
    }

    public function test_protected_routes_return_401_when_unauthenticated(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized()->assertJsonPath('code', 'UNAUTHENTICATED');
        $this->getJson('/api/requests')->assertUnauthorized();
        $this->postJson('/api/requests', [])->assertUnauthorized();
        $this->getJson('/api/requests/1')->assertUnauthorized();
        $this->patchJson('/api/requests/1/status', [])->assertUnauthorized();
        $this->getJson('/api/requests/1/history')->assertUnauthorized();
        $this->postJson('/api/auth/logout')->assertUnauthorized();
    }

    public function test_logout_ends_the_session(): void
    {
        $user = User::factory()->create(['password' => 'secret-pass']);

        $this->withHeaders($this->spa)
            ->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'secret-pass'])
            ->assertOk();

        $this->withHeaders($this->spa)->postJson('/api/auth/logout')->assertOk();

        $this->assertGuest('web');
    }
}
