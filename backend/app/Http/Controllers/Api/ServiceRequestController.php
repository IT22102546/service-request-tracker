<?php

namespace App\Http\Controllers\Api;

use App\Enums\RequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\ListServiceRequestsRequest;
use App\Http\Requests\StoreServiceRequestRequest;
use App\Http\Resources\ServiceRequestResource;
use App\Http\Resources\StatusHistoryResource;
use App\Models\ServiceRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Every query starts from $request->user()->serviceRequests(), so another
 * user's request is simply "not found" (404) – ownership cannot be bypassed
 * by guessing ids, and the API does not reveal which ids exist.
 */
class ServiceRequestController extends Controller
{
    public function index(ListServiceRequestsRequest $request): AnonymousResourceCollection
    {
        $filters = $request->validated();

        $query = $request->user()->serviceRequests()
            ->when($filters['search'] ?? null, function ($q, string $search) {
                // Escape LIKE wildcards so "%" and "_" are matched literally.
                $escaped = addcslashes($search, '\\%_');
                $q->where('title', 'like', '%'.$escaped.'%');
            })
            ->when($filters['status'] ?? null, fn ($q, string $status) => $q->where('status', $status))
            ->when($filters['priority'] ?? null, fn ($q, string $priority) => $q->where('priority', $priority))
            ->orderByDesc('created_at')
            ->orderByDesc('id'); // stable order for rows created in the same second

        return ServiceRequestResource::collection(
            $query->paginate($request->perPage())->withQueryString()
        );
    }

    public function store(StoreServiceRequestRequest $request): JsonResponse
    {
        $serviceRequest = new ServiceRequest($request->validated());
        $serviceRequest->created_by = $request->user()->id;
        $serviceRequest->status = RequestStatus::OPEN;
        $serviceRequest->version = 1;
        $serviceRequest->save();

        return (new ServiceRequestResource($serviceRequest))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, int $id): ServiceRequestResource
    {
        return new ServiceRequestResource($this->findOwned($request, $id));
    }

    public function history(Request $request, int $id): AnonymousResourceCollection
    {
        $serviceRequest = $this->findOwned($request, $id);

        return StatusHistoryResource::collection(
            $serviceRequest->statusHistories()->with('actor:id,name')->orderBy('id')->get()
        );
    }

    private function findOwned(Request $request, int $id): ServiceRequest
    {
        return $request->user()->serviceRequests()->findOrFail($id);
    }
}
