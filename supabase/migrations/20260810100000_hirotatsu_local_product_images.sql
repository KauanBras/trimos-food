-- As imagens passam a ser servidas pelo próprio projeto, sem depender da Glovo.
update public.products
set image_url = '/menu/hirotatsu/' || id::text || '.webp',
    updated_at = now()
where restaurant_id = (
  select id from public.restaurants where slug = 'hirotatsu-sushi' limit 1
)
and id in (
  '9472ca76-f7a9-48f7-8170-49d02f7e031f',
  '83c2d0d0-58a2-4943-8470-03594bbf1eca',
  '79dcc79f-5533-4e9e-8720-4a10f7f6f052',
  '662f6541-11ef-4ba3-9ab0-d4fc9a035b3f',
  '89ddecac-a645-4d94-aaa6-3f05ea3ce3ed',
  'aefdb3b8-923f-4328-a4a8-d297bc759276',
  '5573bf67-96a0-47ac-b3da-661344d6ca7c',
  '3499584c-caeb-42a6-b8fd-76da6d7c49b0',
  '6184b0f5-aec3-4a11-a21c-91f2bfb8b6d4',
  'aade1347-97f0-4d7b-9c6d-16fbaa936691',
  '955f8601-95e6-43ed-82ba-4542baeccbf7',
  '183c3744-4987-4e80-b975-14c50e3a2e2b',
  '5b291a1f-6abc-4d3f-8f77-a4707d1bff3c',
  'ea0e944f-e7f7-4c77-b409-db4cc3e3da2d',
  '9d891b6b-2247-44da-af2e-9ed9624f605e',
  '4c32b593-74c5-4d8f-b647-81559d6290dd',
  '67e00dc5-a162-4c65-be06-f3fbccbc57e8',
  '37d2aa92-28c9-4411-87fb-79fd8cc9b42a',
  '01f4f296-e3d8-44c1-a0ea-01fa664d98b6',
  '0c6577dd-c41c-4a74-9443-d736df1c4cdb',
  '79fd4236-3e27-4594-9291-f1991cccf401',
  'b9bfcd50-a749-4c27-b7ae-9427e3043aef',
  'b76afdb0-6842-4292-924e-06e26be258ea',
  'f2fbb7e5-ebad-4237-b44d-15216746de51',
  'e0fbc1ae-2587-4a1a-a22c-70cd09bcc001',
  'b8cd8fe0-6e96-4399-8ab1-a409bf3f79c0',
  '18012216-1d8a-4f90-a9de-0fe6da0731cd'
);
